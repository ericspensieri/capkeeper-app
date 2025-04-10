import { Component, Input, Output, EventEmitter, OnInit } from '@angular/core';

@Component({
  selector: 'app-draft-order',
  templateUrl: './draft-order.component.html',
  styleUrls: ['./draft-order.component.css'],
  standalone: false
})
export class DraftOrderComponent implements OnInit {
  @Input() teams: any[] = [];
  @Input() disabled: boolean = false;
  @Output() draftOrderChanged = new EventEmitter<any[]>();
  
  draftOrder: any[] = [];
  draggedIndex: number | null = null;
  dragOverIndex: number | null = null;

  ngOnInit() {
    this.initializeOrder();
  }
  
  initializeOrder() {
    this.draftOrder = [...this.teams].sort((a, b) => 
      a.team_name.localeCompare(b.team_name)
    );
    
    this.draftOrderChanged.emit(this.draftOrder);
  }

  onDragStart(event: DragEvent, index: number) {
    if (this.disabled) {
      event.preventDefault();
      return;
    }

    this.draggedIndex = index;
    if (event.dataTransfer) {
      event.dataTransfer.effectAllowed = 'move';
    }
  }

  onDragOver(event: DragEvent, index: number) {
    if (this.disabled) {
      event.preventDefault();
      return;
    }
    event.preventDefault();
    this.dragOverIndex = index;
  }

  onDragEnd(event: DragEvent) {
    if (this.disabled) {
      event.preventDefault();
      return;
    }

    event.preventDefault();
    if (this.draggedIndex !== null && this.dragOverIndex !== null) {
      const newOrder = [...this.draftOrder];
      const draggedItem = newOrder[this.draggedIndex];
      newOrder.splice(this.draggedIndex, 1);
      newOrder.splice(this.dragOverIndex, 0, draggedItem);
      
      this.draftOrder = newOrder;
      this.draftOrderChanged.emit(this.draftOrder);
    }
    
    this.draggedIndex = null;
    this.dragOverIndex = null;
  }

  resetOrder() {
    this.initializeOrder();
  }
}