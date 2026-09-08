import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ImportQueuesComponent } from './import-queues.component';

describe('ImportQueuesComponent', () => {
  let component: ImportQueuesComponent;
  let fixture: ComponentFixture<ImportQueuesComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ ImportQueuesComponent ]
    })
    .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(ImportQueuesComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
