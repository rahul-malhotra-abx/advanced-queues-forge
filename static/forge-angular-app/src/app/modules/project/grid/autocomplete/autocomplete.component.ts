import { Component } from '@angular/core';
import { ICellEditorAngularComp } from 'ag-grid-angular';
import { JiraService } from 'src/app/services/jira.service';
import { IDropdownSettings } from 'ng-multiselect-dropdown'

@Component({
  selector: 'app-autocomplete',
  templateUrl: './autocomplete.component.html',
  styleUrls: ['./autocomplete.component.scss'],
})
export class AutocompleteComponent implements ICellEditorAngularComp {
  /** Same-origin, relative: a leading slash escapes the app's scope on Forge. */
  static readonly AVATAR_PLACEHOLDER = 'assets/images/avatar-placeholder.svg';

  searchValue: string = '';
  issueKey: string = '';
  /**
   * The dropdown is built only once the cell is clicked. It keeps every user in the DOM even while closed, so one
   * per row made a 200-row page freeze while scrolling.
   */
  editing = false;
  assignees: any[] = [];
  assigneesById: { [accountId: string]: any } = {};
  selectedItems: Array<any> = [];
  private row: HTMLElement | null = null;
  dropdownSettings: IDropdownSettings = {
    singleSelection: true,
    idField: 'accountId',
    textField: 'displayName',
    itemsShowLimit: 5,
    allowSearchFilter: true,
    enableCheckAll: false,
    closeDropDownOnSelection: true,
    defaultOpen: true,
  };

  agInit(params: any): void {
    this.selectedItems = [
      {
        accountId: params.node.data.fields.assignee?.accountId || '',
        displayName: params.node.data.fields.assignee?.displayName || 'Unassigned',
        // Was a hardcoded cdn.pixabay.com stock photo, with the intended source
        // commented out beside it as `fields.avatarUrls` — which is undefined,
        // since Jira hangs avatarUrls off the assignee, not off fields. So every
        // row showed the same stranger's face. Forge's CSP blocks that CDN
        // outright, and declaring egress for it would forfeit Runs on Atlassian.
        avatarUrl: params.node.data.fields.assignee?.avatarUrls?.['16x16'] || AutocompleteComponent.AVATAR_PLACEHOLDER,
      }
    ];
    this.issueKey = params.node.data.id;
  }

  getValue(): any {
    return this.searchValue;
  }

  async startEditing(event: Event): Promise<void> {
    // Kept from the document: the dropdown's click-outside listener would otherwise close it on this same click.
    event.stopPropagation();
    // ag-grid paints each row as its own layer, later rows over earlier ones, so the open list needs its row lifted.
    this.row = (event.currentTarget as HTMLElement).closest('.ag-row');
    if (!this.assignees.length) {
      const jiraContext = await JiraService.getContext();
      const users = (await JiraService.getAssignees(jiraContext.jira.project.id)) || [];
      this.assignees = [
        { accountId: null, displayName: 'Unassigned', avatarUrl: AutocompleteComponent.AVATAR_PLACEHOLDER },
        ...users.map((user) => ({ ...user, avatarUrl: user.avatarUrls?.['16x16'] || AutocompleteComponent.AVATAR_PLACEHOLDER })),
      ];
      this.assigneesById = this.assignees.reduce((byId, assignee) => {
        byId[assignee.accountId] = assignee;
        return byId;
      }, {});
    }
    this.editing = true;
    this.row?.classList.add('assignee-editing');
  }

  stopEditing(): void {
    this.editing = false;
    this.row?.classList.remove('assignee-editing');
  }

  onAssigneeChange(selectedAssignee: any): void {
    if (selectedAssignee) {
      const previous = this.selectedItems[0];
      this.selectedItems = [this.assigneesById[selectedAssignee.accountId] ?? selectedAssignee];
      this.searchValue = selectedAssignee.displayName;
      this.assignAssigneeToProject(selectedAssignee.accountId, previous);
    }
  }

  async assignAssigneeToProject(assigneeId: string, previous?: any): Promise<void> {
    try {
      await JiraService.assignUserToIssue(assigneeId, this.issueKey);
    } catch (error) {
      // BUG-12: the cell already shows the new name, so a failure here left the
      // grid disagreeing with Jira and said nothing at all. The cell goes back
      // to who the issue actually has.
      console.error('Error assigning assignee:', error);
      if (previous) {
        this.selectedItems = [previous];
        this.searchValue = previous.displayName;
      }
      JiraService.showNotification(
        'Assignee not changed',
        `${this.issueKey} still has its previous assignee: Jira rejected the change.`,
        'error',
        'manual'
      );
    }
  }
}
