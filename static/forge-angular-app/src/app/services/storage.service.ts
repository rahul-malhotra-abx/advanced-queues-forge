import { StorageContext } from '../models/storage.context.enum';
import { ENVIRONMENT } from '../environment';
import { JiraService } from './jira.service';
import { UtilsService } from './utils.service';

/**
 * A value too large for one Jira property is split across several. Jira has no
 * transaction, so the chunks of a new value are written to a slot that nothing
 * is reading, and `_0` is then pointed at that slot in a single PUT. A reload
 * part-way through a save leaves the previous value intact and readable, which
 * is what BUG-28 was: a first chunk promising chunks that were never written.
 *
 * Layouts this reads, oldest first:
 *   `_0` alone, `{ data, totalSize: 1 }`                  a value that fits
 *   `_0.._n`, each `{ data, totalSize, current }`         pre-BUG-28 chunks
 *   `_0` = `{ slot, totalSize }`, chunks in `_a0`/`_b0`   current
 */
export class StorageService {
  storageBaseKey: string;
  storageContext: StorageContext;
  referenceKey: string;
  itemKey: string;
  singleKeyCharacterLimit = 25000;

  constructor(storageContext: StorageContext, referenceKey: string, storageBaseKey: string, itemKey?: string) {
    this.storageContext = storageContext;
    this.storageBaseKey = ENVIRONMENT.APP_BASE_KEY + '-' + storageBaseKey;
    this.referenceKey = referenceKey;
    this.itemKey = itemKey;
  }

  async save(data: {}) {
    const stringData = JSON.stringify(data) ?? '';
    const properties: any[] = [];
    let pointer: any;

    if (stringData.length < this.singleKeyCharacterLimit) {
      // One property, so one PUT, which is atomic on its own. Written in the
      // shape every earlier version wrote, so a rollback can still read it.
      properties.push({ key: this.chunkKey(0), value: { data, totalSize: 1, current: 0 } });
    } else {
      const chunks = stringData.match(/.{1,25000}/g) || [''];
      const slot = (await this.readPointer())?.slot === 'a' ? 'b' : 'a';
      chunks.forEach((chunk, index) =>
        properties.push({ key: this.slotKey(slot, index), value: { data: chunk, totalSize: chunks.length, current: index } })
      );
      pointer = { key: this.chunkKey(0), value: { slot, totalSize: chunks.length } };
    }

    // Every caller invokes save() without awaiting it and without a .catch, so
    // before this a rejected write was an unhandled promise rejection behind an
    // optimistic UI: the edit appeared to apply and was never stored, silently.
    // A 403 from a permission problem looked exactly like a successful save.
    //
    // Reporting here rather than at the 10+ call sites: they would all need the
    // same await and the same catch, and the one that got missed would be the
    // one that mattered. Swallowing the rejection also means the fire-and-forget
    // callers no longer produce unhandled rejections.
    try {
      await this.saveProperties(properties);
      // Last, alone, and only once every chunk above is stored.
      if (pointer) {
        await this.saveProperties([pointer]);
      }
      return true;
    } catch (error) {
      console.error(`Failed to save ${this.storageBaseKey}`, error);
      const permissionDenied = /\b40[13]\b/.test(String((error as any)?.message ?? error));
      JiraService.showNotification(
        'Changes not saved',
        permissionDenied
          ? 'You do not have permission to change this in this project. Your edit has not been stored.'
          : 'Jira rejected the change, so your edit has not been stored. Reload and try again.',
        'error',
        'manual'
      );
      return false;
    }
  }

  async get(): Promise<any> {
    // `_0` and the four after it in one request: a pre-BUG-28 value of five
    // chunks or fewer still needs no second round trip.
    const properties = await this.getProperties(this.chunkKeys(0));
    const pointer = properties[this.chunkKey(0)];
    try {
      if (pointer?.slot) {
        return await this.readSlot(pointer.slot, pointer.totalSize);
      }
      const totalSize = pointer?.totalSize ?? 0;
      for (let from = 5; from < totalSize; from += 5) {
        Object.assign(properties, await this.getProperties(this.chunkKeys(from)));
      }
      return UtilsService.mergeJiraDataKeys(properties, this.storageBaseKey);
    } catch (error) {
      // A value that cannot be assembled used to throw out of here and take the
      // whole page with it, for everyone on the project when it was the
      // project's list. Defaults are shown instead, and nothing is overwritten
      // until the user saves, which the flag warns them about.
      console.error(`Failed to read ${this.storageBaseKey}`, error);
      JiraService.showNotification(
        'Saved data could not be read',
        'Part of this project\'s Advanced Queues data is unreadable, so defaults are shown. Nothing has been changed. Reload to try again.',
        'error',
        'manual'
      );
      return undefined;
    }
  }

  private chunkKey(index: number) {
    return `${this.storageBaseKey}_${index}`;
  }

  private slotKey(slot: string, index: number) {
    return `${this.storageBaseKey}_${slot}${index}`;
  }

  /** Five keys from `from`: Jira rejects a read that names six or more properties (measured). */
  private chunkKeys(from: number) {
    return [...Array(5).keys()].map((i) => this.chunkKey(from + i));
  }

  private async readPointer(): Promise<any> {
    const properties = await this.getProperties([this.chunkKey(0)]).catch(() => ({}));
    return properties?.[this.chunkKey(0)];
  }

  /** Throws on a chunk the pointer promised and Jira does not hold, which get() reports. */
  private async readSlot(slot: string, totalSize: number): Promise<any> {
    const parts: string[] = [];
    for (let from = 0; from < totalSize; from += 5) {
      const keys = [...Array(5).keys()].map((i) => this.slotKey(slot, from + i)).slice(0, totalSize - from);
      const properties = await this.getProperties(keys);
      for (const key of keys) {
        const chunk = properties[key];
        if (!chunk) {
          throw new Error(`${key} is missing, though ${this.chunkKey(0)} names ${totalSize} chunks in slot ${slot}`);
        }
        parts.push(typeof chunk.data === 'object' ? JSON.stringify(chunk.data) : chunk.data);
      }
    }
    return JSON.parse(parts.join(''));
  }

  private saveProperties(properties: any[]): Promise<any> {
    if (this.storageContext === StorageContext.PROJECT) {
      return JiraService.saveProjectProperties(this.referenceKey, properties);
    } else if (this.storageContext === StorageContext.USER) {
      return JiraService.saveUserProperties(this.referenceKey, properties);
    }
    return JiraService.saveTicketProperties(this.referenceKey, properties);
  }

  private getProperties(keys: string[]): Promise<any> {
    if (this.storageContext === StorageContext.PROJECT) {
      return JiraService.getProjectProperties(this.referenceKey, keys);
    } else if (this.storageContext === StorageContext.USER) {
      return JiraService.getUserProperties(this.referenceKey, keys);
    }
    return JiraService.getTicketProperties(this.referenceKey, keys);
  }
}
