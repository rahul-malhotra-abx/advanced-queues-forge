import {NgModule} from '@angular/core';
import {CommonModule} from '@angular/common';
import {ProjectEnablementComponent} from './project-enablement/project-enablement.component';
import {AppAdminPanelRoutingModule} from './app-admin-panel-routing.module';
import {FormsModule, ReactiveFormsModule} from "@angular/forms";
import {FilterPipeModule} from "ngx-filter-pipe";
import {NgbTooltipModule} from "@ng-bootstrap/ng-bootstrap";
import {MatDialogModule} from "@angular/material/dialog";
import {MatAutocompleteModule} from "@angular/material/autocomplete";
import {MatFormFieldModule} from "@angular/material/form-field";
import {MatInputModule} from "@angular/material/input";

@NgModule({
  declarations: [
    ProjectEnablementComponent
  ],
  imports: [
    AppAdminPanelRoutingModule,
    CommonModule,
    FormsModule,
    FilterPipeModule,
    NgbTooltipModule,
    MatDialogModule,
    FormsModule,
    ReactiveFormsModule,
    MatAutocompleteModule,
    MatFormFieldModule,
    MatInputModule
  ]
})
export class AppAdminPanelModule {
}
