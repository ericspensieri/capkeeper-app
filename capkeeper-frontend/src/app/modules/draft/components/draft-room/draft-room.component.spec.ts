import { ComponentFixture, TestBed } from '@angular/core/testing';

import { DraftRoomComponent } from './draft-room.component';

describe('DraftRoomComponent', () => {
  let component: DraftRoomComponent;
  let fixture: ComponentFixture<DraftRoomComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [DraftRoomComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(DraftRoomComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
