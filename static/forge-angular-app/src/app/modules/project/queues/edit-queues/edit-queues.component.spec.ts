import { ComponentFixture, TestBed } from '@angular/core/testing';

import { EditQueuesComponent } from './edit-queues.component';

describe('EditQueuesComponent', () => {
  let component: EditQueuesComponent;
  let fixture: ComponentFixture<EditQueuesComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ EditQueuesComponent ]
    })
    .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(EditQueuesComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
