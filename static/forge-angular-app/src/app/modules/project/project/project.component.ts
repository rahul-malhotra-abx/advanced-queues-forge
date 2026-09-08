import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { ENVIRONMENT } from '../../../environment';
import { JiraService } from '../../../services/jira.service';

@Component({
  selector: 'app-project',
  templateUrl: './project.component.html',
  styleUrls: ['./project.component.scss'],
})
export class ProjectComponent implements OnInit {
  isInJIRA = window.parent !== window;
  links: any[] = [
    {
      route: 'queues',
      label: 'Queues',
      // Relative: a Forge app is served from a path on the CDN, so a leading slash escapes its scope.
      image: 'assets/images/advanced-queues-dark.svg',
    },
    // {
    //   route: 'settings',
    //   label: 'Settings',
    //   requireAdminRole: true,
    //   icon: 'fa fa-sliders-h'
    // }
  ];
  activeLink: any;
  projectKey: string | undefined;
  isAdmin = true;
  Environment = ENVIRONMENT;

  constructor(private router: Router) {}

  async ngOnInit() {
    this.activeLink = this.links.find(async (link) => {
      if (this.isInJIRA) {
        const jiraContext = await JiraService.getContext();
        this.projectKey = jiraContext.jira.project.key;
      }
      const lastPart = this.router.url.split('/')[this.router.url.split('/').length - 1];
      return lastPart === link.route;
    });
  }
}
