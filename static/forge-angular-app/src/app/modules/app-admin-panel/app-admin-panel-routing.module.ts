import {NgModule} from '@angular/core';
import {Routes, RouterModule} from '@angular/router';
import {ProjectEnablementComponent} from './project-enablement/project-enablement.component';

const routes: Routes = [
  {
    path: 'project-enablement',
    component: ProjectEnablementComponent,
  },
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class AppAdminPanelRoutingModule {
}
