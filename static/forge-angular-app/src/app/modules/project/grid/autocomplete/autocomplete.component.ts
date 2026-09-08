import { Component, OnInit } from '@angular/core';
import { ICellEditorAngularComp } from 'ag-grid-angular';
import { JiraService } from 'src/app/services/jira.service';
import { IDropdownSettings } from 'ng-multiselect-dropdown'
import { JiraUserModel } from 'src/app/models/jira.user.model';

@Component({
  selector: 'app-autocomplete',
  templateUrl: './autocomplete.component.html',
  styleUrls: ['./autocomplete.component.scss'],
})
export class AutocompleteComponent implements ICellEditorAngularComp, OnInit {
  /** Same-origin, relative: a leading slash escapes the app's scope on Forge. */
  static readonly AVATAR_PLACEHOLDER = 'assets/images/avatar-placeholder.svg';

  searchValue: string = '';
  issueKey: string = '';
  projectKey: string = '';
  filteredAssignees: any[] = [];
  filteredAssigneesList: Array<any> = [];
  loading: boolean = true;
  selectedItem: Array<string> = [];
  selectedItems: Array<any> = [];
  dropdownSettings: IDropdownSettings = {};

  agInit(params: any): void {
    this.selectedItems = [
      {
        accountId: params.node.data.fields.assignee?.accountId || '',
        displayName: params.node.data.fields.assignee?.displayName || 'Unassignee',
        // Was a hardcoded cdn.pixabay.com stock photo, with the intended source
        // commented out beside it as `fields.avatarUrls` — which is undefined,
        // since Jira hangs avatarUrls off the assignee, not off fields. So every
        // row showed the same stranger's face. Forge's CSP blocks that CDN
        // outright, and declaring egress for it would forfeit Runs on Atlassian.
        avatarUrl: params.node.data.fields.assignee?.avatarUrls?.['16x16'] || AutocompleteComponent.AVATAR_PLACEHOLDER,
      }
    ];
    this.issueKey = params.node.data.id;
    this.ngOnInit();
  }

  getValue(): any {
    return this.searchValue;
  }

  async ngOnInit(): Promise<void> {
    this.dropdownSettings = {
      singleSelection: true,
      idField: 'accountId',
      textField: 'displayName',
      itemsShowLimit: 5,
      selectAllText: 'Select All',
      unSelectAllText: 'UnSelect All',
      allowSearchFilter: true,
      enableCheckAll: false,
    };

    const jiraContext = await JiraService.getContext();
    this.projectKey = jiraContext.jira.project.id;
    this.loading = true;

    const data = await JiraService.getAssignees(this.projectKey);
    this.filteredAssignees = data;
    this.filteredAssigneesList = this.filteredAssignees.map(assignee => ({
      ...assignee,
      avatarUrl: assignee.avatarUrls?.['16x16'] || AutocompleteComponent.AVATAR_PLACEHOLDER
    }));

    this.filteredAssigneesList.unshift({
      accountId: null ,
      displayName: 'Unassignee',
      avatarUrl: AutocompleteComponent.AVATAR_PLACEHOLDER
    })

    this.loading = false;
  } catch(error) {
    console.error('Error fetching assignees:', error);
    this.loading = false;
  }

  get getItems() {
    return this.filteredAssigneesList.reduce((acc, curr) => {
      acc[curr.accountId] = curr;
      return acc;
    }, {});
  }

  handleReset() {
    this.selectedItem = [];
  }

  onAssigneeChange(event: any): void {
    const selectedAssignee = event;
    if (selectedAssignee) {
      this.searchValue = selectedAssignee.displayName;
      this.assignAssigneeToProject(selectedAssignee.accountId);
    }
  }


  async assignAssigneeToProject(assigneeId: string): Promise<void> {
    try {
      this.loading = true;
      const response = await JiraService.assignUserToIssue(assigneeId, this.issueKey);
      console.log('Assignee assigned successfully:', response);

      this.loading = false;
    } catch (error) {
      console.error('Error assigning assignee:', error);
      this.loading = false;
    }
  }

  onAssigneeRemove(event: any): void {
    const removedAssignee = event;
    this.filteredAssignees = this.filteredAssignees.filter(
      assignee => assignee.accountId !== removedAssignee.accountId
    );
  }
}
