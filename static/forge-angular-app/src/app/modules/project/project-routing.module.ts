import {NgModule} from '@angular/core';
import {Routes, RouterModule} from '@angular/router';
import {ProjectComponent} from './project/project.component';
import {ProjectSettingsComponent} from './settings/project-settings.component';
import {QueuesComponent} from "./queues/queues.component";

const routes: Routes = [
  {
    path: '',
    component: ProjectComponent,
    children: [
      {
        path: 'queues',
        component: QueuesComponent,
      },
      {
        path: 'settings',
        component: ProjectSettingsComponent,
      }
    ]
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class ProjectRoutingModule {
}
