import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ProjectEnablementComponent } from './project-enablement.component';

describe('ProjectEnablementComponent', () => {
  let component: ProjectEnablementComponent;
  let fixture: ComponentFixture<ProjectEnablementComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ ProjectEnablementComponent ]
    })
    .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(ProjectEnablementComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
