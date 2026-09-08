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
    console.log(params);
    this.selectedItems = [
      {
        accountId: params.node.data.fields.assignee?.accountId || '',
        displayName: params.node.data.fields.assignee?.displayName || 'Unassignee',
        avatarUrl: 'https://cdn.pixabay.com/photo/2017/06/13/12/54/profile-2398783_1280.png' //params.node.data.fields.avatarUrls['16x16'],
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
      avatarUrl: assignee.avatarUrls?.['16x16'] || 'https://cdn.pixabay.com/photo/2017/06/13/12/54/profile-2398783_1280.png'
    }));

    this.filteredAssigneesList.unshift({
      accountId: null ,
      displayName: 'Unassignee',
      avatarUrl: 'https://cdn.pixabay.com/photo/2017/06/13/12/54/profile-2398783_1280.png'
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
