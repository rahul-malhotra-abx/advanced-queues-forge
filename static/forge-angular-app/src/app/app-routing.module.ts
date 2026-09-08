import {NgModule} from '@angular/core';
import {RouterModule, Routes} from '@angular/router';

const routes: Routes = [
  {
    path: '',
    redirectTo: 'ticket',
    pathMatch: 'full'
  },
  {
    path: 'project/:id',
    loadChildren: () => import('./modules/project/project.module').then(m => m.ProjectModule)
  },
  {
    path: 'app-admin-panel',
    loadChildren: () => import('./modules/app-admin-panel/app-admin-panel.module').then(m => m.AppAdminPanelModule)
  },
];

@NgModule({
  imports: [RouterModule.forRoot(routes, {useHash: true, relativeLinkResolution: 'legacy'})],
  exports: [RouterModule]
})
export class AppRoutingModule {
}
