import {Component, OnInit, ViewEncapsulation} from '@angular/core';
import {JiraService} from '../../../services/jira.service';
import {animate, style, transition, trigger} from '@angular/animations';
import {ENVIRONMENT} from '../../../environment';
import {DataStorageKeys} from '../../../models/data.storage.keys.model';
import {DefaultProjectAdminSettings} from '../../../models/default.project.admin.settings.model';
import {UtilsService} from '../../../services/utils.service';

@Component({
  selector: 'app-project-enablement',
  templateUrl: './project-enablement.component.html',
  styleUrls: ['./project-enablement.component.scss'],
  encapsulation: ViewEncapsulation.None,
  animations: [
    trigger(
      'enterAnimation', [
        transition(':enter', [
          style({opacity: 0}),
          animate('500ms', style({opacity: 1}))
        ]),
        transition(':leave', [
          style({opacity: 1}),
          animate('500ms', style({opacity: 0}))
        ])
      ]
    )
  ]
})
export class ProjectEnablementComponent implements OnInit {

  projects: any[] = [];
  pageLoaded = false;
  searchFilter = {
    name: ''
  };
  maxResults = 50;
  UtilService = UtilsService;

  constructor() {
  }

  async ngOnInit() {
    let response: any = {isLast: false, values: []};
    while (!response.isLast) {
      response = await JiraService.getAllProjects('', this.maxResults, this.projects.length);
      this.projects.push(...response.values);
    }
    for (const project of this.projects) {
      if (!project.properties[`${ENVIRONMENT.APP_BASE_KEY}_${DataStorageKeys.PROJECT_ADMIN_SETTINGS}`]) {
        project.properties[`${ENVIRONMENT.APP_BASE_KEY}_${DataStorageKeys.PROJECT_ADMIN_SETTINGS}`] =
          UtilsService.deepCopy(DefaultProjectAdminSettings);
      }
      // Normalised, not read raw: a Connect-written flag can be the string
      // "false", which is truthy and would render this toggle as Enabled for a
      // project that is actually disabled. See JiraService.normaliseProjectAdminSettings.
      project.adminSettings = JiraService.normaliseProjectAdminSettings(
        project.properties[`${ENVIRONMENT.APP_BASE_KEY}_${DataStorageKeys.PROJECT_ADMIN_SETTINGS}`]
      );
    }
    this.pageLoaded = true;
  }

  async updateStatus(index: number) {
    const currentProject = this.projects[index];
    await JiraService.saveProjectSettings(currentProject.adminSettings, currentProject.id);
  }
}
