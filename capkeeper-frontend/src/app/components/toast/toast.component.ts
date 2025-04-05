import { Component, Input, OnDestroy, OnInit } from '@angular/core';

@Component({
  selector: 'app-toast',
  standalone: false,
  template: `
    <div *ngIf="isVisible" id="toast" class="z-50 toast fixed bottom-4 right-4 w-auto max-w-lg p-4 mb-4 flex items-center justify-between text-gray-500 bg-white rounded-lg shadow-lg dark:text-gray-400 dark:bg-gray-800" role="alert">
      <!-- Success Icon -->
      <div *ngIf="isSuccessful" class="flex items-center justify-center flex-shrink-0 w-8 h-8 text-green-400 bg-green-100 rounded-lg dark:bg-green-800 dark:text-green-200 mr-3">
        <svg class="w-5 h-5" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" fill="currentColor" viewBox="0 0 20 20">
          <path d="M10 .5a9.5 9.5 0 1 0 9.5 9.5A9.51 9.51 0 0 0 10 .5Zm3.707 8.207-4 4a1 1 0 0 1-1.414 0l-2-2a1 1 0 0 1 1.414-1.414L9 10.586l3.293-3.293a1 1 0 0 1 1.414 1.414Z"/>
        </svg>
      </div>

      <!-- Error Icon -->
      <div *ngIf="!isSuccessful" class="flex items-center justify-center flex-shrink-0 w-8 h-8 text-red-400 bg-red-100 rounded-lg dark:bg-red-800 dark:text-red-200 mr-3">
        <svg class="w-5 h-5" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" fill="currentColor" viewBox="0 0 20 20">
          <path d="M10 .5a9.5 9.5 0 1 0 9.5 9.5A9.51 9.51 0 0 0 10 .5Zm3.707 11.793a1 1 0 1 1-1.414 1.414L10 11.414l-2.293 2.293a1 1 0 0 1-1.414-1.414L8.586 10 6.293 7.707a1 1 0 0 1 1.414-1.414L10 8.586l2.293-2.293a1 1 0 0 1 1.414 1.414L11.414 10l2.293 2.293Z"/>
        </svg>
      </div>

      <!-- Toast Message -->
      <div class="text-gray-800 toast-message flex-grow text-sm font-semibold max-w-60">
        {{ message }}
      </div>

      <!-- Close Button -->
      <button type="button" class="ms-3 -mx-1.5 -my-1.5 bg-white text-gray-400 hover:text-gray-900 rounded-lg focus:ring-2 focus:ring-gray-300 p-1.5 hover:bg-gray-100 inline-flex items-center justify-center h-8 w-8 dark:text-gray-500 dark:hover:text-white dark:bg-gray-800 dark:hover:bg-gray-700" aria-label="Close" (click)="dismissToast()">
        <span class="sr-only">Close</span>
        <svg class="w-3 h-3" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 14 14">
          <path stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="m1 1 6 6m0 0 6 6M7 7l6-6M7 7l-6 6"/>
        </svg>
      </button>
    </div>
  `,
})
export class ToastComponent implements OnDestroy, OnInit {
  @Input() message!: string;
  @Input() isSuccessful: boolean = true;

  isVisible: boolean = true; 
  timeoutHandle: any;

  ngOnInit() {
    this.autoDismiss();
  }

  ngOnDestroy() {
    if (this.timeoutHandle) {
      clearTimeout(this.timeoutHandle);
    }
  }

  dismissToast() {
    this.isVisible = false;
  }

  autoDismiss(timeout = 4500) {
    this.timeoutHandle = setTimeout(() => this.dismissToast(), timeout);
  }
}
