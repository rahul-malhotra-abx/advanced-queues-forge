import { Component, OnInit } from '@angular/core';
import { JiraService } from '../../../services/jira.service';
import { ENVIRONMENT } from '../../../environment';
import { ActivatedRoute } from '@angular/router';
import { DefaultProjectAdminSettings, ProjectAdminSetting } from '../../../models/default.project.admin.settings.model';

@Component({
  selector: 'app-settings',
  templateUrl: './project-settings.component.html',
  styleUrls: ['./project-settings.component.scss'],
})
export class ProjectSettingsComponent implements OnInit {
  projectIdOrKey: any;
  projectSettings: ProjectAdminSetting;
  ENVIRONMENT = ENVIRONMENT;
  dateFormats = [
    {
      value: 'MM/DD/YYYY hh:mm:ss',
      label: 'MM/DD/YYYY hh:mm:ss (11/25/2022 13:47:32)',
    },
    {
      value: 'DD/MM/YYYY hh:mm:ss',
      label: 'DD/MM/YYYY hh:mm:ss (25/11/2022 13:47:32)',
    },
    {
      value: 'MM-DD-YYYY hh:mm:ss',
      label: 'MM-DD-YYYY hh:mm:ss (11-25-2022 13:47:32)',
    },
    {
      value: 'DD-MM-YYYY hh:mm:ss',
      label: 'DD-MM-YYYY hh:mm:ss (25-11-2022 13:47:32)',
    },
    {
      value: 'Relative',
      label: 'Relative (6 Hours ago)',
    },
  ];
  constructor(private route: ActivatedRoute) {}

  async ngOnInit() {
    this.projectIdOrKey = this.route.parent.params['value'].id;
    const storageSettings = (await JiraService.getProjectSettings(this.projectIdOrKey)) || {};
    this.projectSettings = Object.assign(DefaultProjectAdminSettings, storageSettings);
  }
}
