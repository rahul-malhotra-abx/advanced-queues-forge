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
  }

  onAssigneeChange(selectedAssignee: any): void {
    if (selectedAssignee) {
      this.selectedItems = [this.assigneesById[selectedAssignee.accountId] ?? selectedAssignee];
      this.searchValue = selectedAssignee.displayName;
      this.assignAssigneeToProject(selectedAssignee.accountId);
    }
  }

  async assignAssigneeToProject(assigneeId: string): Promise<void> {
    try {
      const response = await JiraService.assignUserToIssue(assigneeId, this.issueKey);
      console.log('Assignee assigned successfully:', response);
    } catch (error) {
      console.error('Error assigning assignee:', error);
    }
  }
}
