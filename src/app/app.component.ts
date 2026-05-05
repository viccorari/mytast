import { Component, OnInit, signal, computed, inject, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

// Firebase Imports
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, signInWithCustomToken, onAuthStateChanged, User } from 'firebase/auth';
import { getFirestore, collection, onSnapshot, addDoc, updateDoc, deleteDoc, doc, setDoc } from 'firebase/firestore';

// Configuración inyectada por el entorno
declare const __firebase_config: string;
declare const __app_id: string;
declare const __initial_auth_token: string;

interface SubTask {
  id: string;
  text: string;
  status: 'pending' | 'completed';
  color?: string; // Nuevo: Color para sublista
}

interface Task {
  id?: string;
  text: string;
  category: string;
  status: 'pending' | 'completed';
  deadline?: string | null;
  subtasks?: SubTask[];
  createdAt: number;
  color?: string; // Nuevo: Color para tarea
}

interface Column {
  id: string;
  title: string;
  color: string;
  locked?: boolean; // Para evitar que se borre el Inbox
}

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="min-h-screen bg-[#0f172a] text-slate-200 font-sans flex flex-col overflow-hidden relative">
      
      <!-- HEADER COMPACTO -->
      <header class="p-2 md:p-3 bg-[#1e293b] border-b border-slate-700 flex flex-col md:flex-row justify-between items-center gap-3 shadow-2xl z-10 shrink-0">
        <div class="flex items-center gap-2 md:gap-3 w-full md:w-auto justify-center md:justify-start">
          <div class="p-1.5 md:p-2 bg-blue-600 rounded-lg shadow-lg shadow-blue-900/20 shrink-0">
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" class="md:w-6 md:h-6" fill="#fff" viewBox="0 0 256 256"><path d="M208,40H48A16,16,0,0,0,32,56V200a16,16,0,0,0,16,16H208a16,16,0,0,0,16-16V56A16,16,0,0,0,208,40Zm0,160H48V56H208V200Zm-32-80a8,8,0,0,1-8,8H88a8,8,0,0,1,0-16h80A8,8,0,0,1,176,120Zm0-32a8,8,0,0,1-8,8H88a8,8,0,0,1,0-16h80A8,8,0,0,1,176,88Zm0,64a8,8,0,0,1-8,8H88a8,8,0,0,1,0-16h80A8,8,0,0,1,176,152Z"></path></svg>
          </div>
          <div>
            <h1 class="text-base md:text-xl font-black tracking-tighter text-white leading-none">COMMAND CENTER <span class="text-blue-500 text-[10px] md:text-xs font-mono align-top ml-1">V4.1</span></h1>
            <p class="text-slate-400 text-[9px] md:text-[10px] font-mono uppercase tracking-widest flex items-center justify-center md:justify-start gap-1.5 mt-0.5">
              <span class="w-1.5 h-1.5 rounded-full" [ngClass]="user() ? 'bg-green-500 animate-pulse' : 'bg-red-500'"></span>
              {{ user() ? 'Online · Listas Dinámicas' : 'Offline' }}
            </p>
          </div>
        </div>

        <div class="flex items-center gap-3 w-full md:w-auto justify-between md:justify-end">
          <div class="bg-slate-800 p-0.5 rounded-md border border-slate-700 flex gap-0.5">
            <button (click)="viewMode.set('kanban')" [class.bg-blue-600]="viewMode() === 'kanban'" class="px-3 py-1.5 rounded text-[10px] md:text-xs font-bold transition-all">KANBAN</button>
            <button (click)="viewMode.set('timeline')" [class.bg-blue-600]="viewMode() === 'timeline'" class="px-3 py-1.5 rounded text-[10px] md:text-xs font-bold transition-all">TIMELINE</button>
          </div>

          <button (click)="toggleListening()" 
            [disabled]="isProcessingAI()"
            class="relative flex items-center justify-center w-10 h-10 md:w-12 md:h-12 rounded-lg md:rounded-xl transition-all duration-300 group shrink-0"
            [ngClass]="{
              'bg-blue-600 shadow-lg shadow-blue-600/20 hover:scale-105': !isListening() && !isProcessingAI(),
              'bg-red-500 animate-pulse scale-105 shadow-red-500/40': isListening(),
              'bg-slate-700 opacity-50': isProcessingAI()
            }">
            <svg *ngIf="!isProcessingAI()" xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="#fff" viewBox="0 0 256 256"><path d="M128,176a48.05,48.05,0,0,0,48-48V64a48,48,0,0,0-96,0v64A48.05,48.05,0,0,0,128,176ZM96,64a32,32,0,0,1,64,0v64a32,32,0,0,1-64,0Zm104,64a8,8,0,0,1-16,0,56,56,0,0,1-112,0,8,8,0,0,1-16,0,72.08,72.08,0,0,0,64,71.49V232a8,8,0,0,0,16,0V199.49A72.08,72.08,0,0,0,200,128Z"></path></svg>
            <svg *ngIf="isProcessingAI()" class="animate-spin" xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="#fff" viewBox="0 0 256 256"><path d="M232,128a104,104,0,0,1-208,0c0-41,23.81-78.36,60.66-95.27a8,8,0,0,1,6.68,14.54C60.15,61.59,40,93.27,40,128a88,88,0,0,0,176,0c0-34.73-20.15-66.41-51.34-80.73a8,8,0,0,1,6.68-14.54C208.19,49.64,232,87,232,128Z"></path></svg>
          </button>
        </div>
      </header>

      <main class="flex-1 overflow-auto p-3 md:p-4 bg-[radial-gradient(circle_at_top_right,_var(--tw-gradient-stops))] from-slate-800 via-slate-900 to-slate-950">
        
        <div *ngIf="statusMessage()" class="max-w-xl mx-auto mb-3 p-2 rounded-lg border border-blue-500/30 bg-blue-500/10 text-blue-300 text-center animate-bounce shadow-lg backdrop-blur text-[11px] md:text-xs">
          {{ statusMessage() }}
        </div>

        <!-- VISTA KANBAN DRAG & DROP Y DENSA -->
        <div *ngIf="viewMode() === 'kanban'" class="flex flex-col lg:flex-row gap-4 h-full items-start pb-4 min-w-max">
          <ng-container *ngFor="let col of columns()">
            <!-- COLUMNA -->
            <div class="w-full lg:w-[300px] xl:w-[340px] flex-shrink-0 flex flex-col max-h-[500px] lg:max-h-full bg-slate-900/60 rounded-2xl border border-slate-800 shadow-xl overflow-hidden backdrop-blur-sm group/col">
              
              <!-- HEADER DE COLUMNA (Edición Inline) -->
              <div class="p-3 border-b border-slate-800 flex items-center justify-between bg-slate-800/40 shrink-0 relative">
                <div class="flex items-center gap-2 flex-1 min-w-0 pr-2">
                  
                  <!-- BOTÓN COLOR PICKER LISTA -->
                  <div class="relative z-50">
                    <div class="w-1.5 h-4 rounded-full cursor-pointer hover:scale-125 transition-transform" 
                         [style.background-color]="col.color"
                         (click)="toggleColorPicker('col_' + col.id, $event)" title="Elegir color"></div>
                    
                    <div *ngIf="activeColorPicker() === 'col_' + col.id"
                         class="absolute top-6 left-0 bg-slate-800 border border-slate-600 rounded-lg p-2 shadow-2xl flex flex-wrap gap-1.5 w-[116px] z-50"
                         (click)="$event.stopPropagation()">
                      <div *ngFor="let c of palette"
                           class="w-5 h-5 rounded-full cursor-pointer hover:scale-110 border-2 border-transparent hover:border-white transition-all shadow-sm"
                           [style.background-color]="c"
                           (mousedown)="$event.preventDefault(); $event.stopPropagation()"
                           (click)="setColumnColor(col, c); activeColorPicker.set(null); $event.stopPropagation()"></div>
                    </div>
                  </div>
                  
                  <!-- INPUT INLINE PARA EL TÍTULO DE LA LISTA -->
                  <input type="text" [(ngModel)]="col.title" (blur)="updateColumn(col.id, col.title)"
                         class="bg-transparent border-transparent focus:border-slate-600 focus:bg-slate-800/50 hover:bg-slate-800/30 rounded p-1 -ml-1 text-xs md:text-sm font-bold uppercase tracking-wide flex-1 w-full min-w-0 transition-colors outline-none"
                         [style.color]="col.color"
                         (keydown.enter)="$event.target.blur()">
                </div>
                
                <div class="flex items-center gap-1">
                  <!-- Botón de Eliminar Columna (Oculto si es Inbox) -->
                  <button *ngIf="!col.locked" (click)="deleteColumn(col.id)" class="opacity-0 lg:group-hover/col:opacity-100 p-1 text-slate-500 hover:text-red-400 hover:bg-slate-700 rounded transition-all">
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" fill="currentColor" viewBox="0 0 256 256"><path d="M216,48H176V40a24,24,0,0,0-24-24H104A24,24,0,0,0,80,40v8H40a8,8,0,0,0,0,16h8V208a16,16,0,0,0,16,16H192a16,16,0,0,0,16-16V64h8a8,8,0,0,0,0-16ZM96,40a8,8,0,0,1,8-8h48a8,8,0,0,1,8,8v8H96Zm96,168H64V64H192Z"></path></svg>
                  </button>
                  <span class="bg-slate-800 text-slate-400 px-2 py-0.5 rounded-full text-[10px] font-black shrink-0">{{ getTasksByCategory(col.id).length }}</span>
                </div>
              </div>
              
              <!-- ZONA DE DROP -->
              <div class="p-2 overflow-y-auto space-y-2 custom-scrollbar flex-1 min-h-[150px]"
                   (dragover)="onDragOver($event)"
                   (drop)="onDrop($event, col.id)">
                
                <!-- TARJETAS -->
                <div *ngFor="let task of getTasksByCategory(col.id)" 
                     draggable="true"
                     (dragstart)="onDragStart(task)"
                     (dragover)="onDragOverTask($event)"
                     (drop)="onDrop($event, col.id, task)"
                     class="bg-slate-800 p-3 rounded-xl border border-slate-700/80 hover:border-blue-500/60 transition-all cursor-grab active:cursor-grabbing group/card relative"
                     [ngClass]="{'opacity-50 grayscale': task.status === 'completed', 'border-blue-500 shadow-[0_0_15px_rgba(59,130,246,0.3)] bg-slate-800/90': draggedTask?.id === task.id}">
                  
                  <div class="flex items-start gap-2">
                    <!-- CHECKBOX -->
                    <button (click)="toggleTask(task)" 
                      class="mt-1 w-5 h-5 rounded-md border-[1.5px] flex items-center justify-center transition-all shrink-0 cursor-pointer"
                      [ngClass]="task.status === 'completed' ? 'bg-green-500 border-green-500' : 'border-slate-500 hover:border-green-500'">
                      <svg *ngIf="task.status === 'completed'" xmlns="http://www.w3.org/2000/svg" width="10" height="10" fill="#000" viewBox="0 0 256 256"><path d="M229.66,77.66l-128,128a8,8,0,0,1-11.32,0l-56-56a8,8,0,0,1,11.32-11.32L96,188.69,218.34,66.34a8,8,0,0,1,11.32,11.32Z"></path></svg>
                    </button>
                    
                    <div class="flex-1 min-w-0">
                      
                      <!-- INPUT INLINE PARA EL TÍTULO DE LA TAREA Y COLOR -->
                      <div class="flex items-start gap-1.5">
                        <div class="relative z-50 shrink-0 mt-1.5">
                          <div class="w-1.5 h-3 rounded-full cursor-pointer hover:scale-125 transition-transform"
                               [style.background-color]="task.color || '#64748b'"
                               (click)="toggleColorPicker('task_' + task.id, $event)" title="Color de la tarea"></div>
                          <div *ngIf="activeColorPicker() === 'task_' + task.id"
                               class="absolute top-5 left-0 bg-slate-800 border border-slate-600 rounded-lg p-2 shadow-2xl flex flex-wrap gap-1.5 w-[116px] z-50"
                               (click)="$event.stopPropagation()">
                            <div *ngFor="let c of palette"
                                 class="w-5 h-5 rounded-full cursor-pointer hover:scale-110 border-2 border-transparent hover:border-white transition-all shadow-sm"
                                 [style.background-color]="c"
                                 (mousedown)="$event.preventDefault(); $event.stopPropagation()"
                                 (click)="setTaskColor(task, c); activeColorPicker.set(null); $event.stopPropagation()"></div>
                          </div>
                        </div>
                        <textarea [(ngModel)]="task.text" (blur)="updateTask(task.id!, {text: task.text})"
                               class="w-full bg-transparent border-transparent focus:border-slate-600 focus:bg-slate-800/80 hover:bg-slate-700/30 rounded p-1 -ml-1 text-xs md:text-sm font-semibold leading-tight placeholder-slate-500 resize-none outline-none transition-colors overflow-hidden"
                               [style.color]="task.color || '#f1f5f9'"
                               rows="2"
                               (keydown.enter)="$event.preventDefault(); $event.target.blur()"></textarea>
                      </div>
                      
                      <!-- METADATA -->
                      <div class="flex flex-wrap gap-1.5 mb-1 px-1">
                        <span *ngIf="task.deadline" class="px-1.5 py-0.5 bg-red-500/10 text-red-400 border border-red-500/20 rounded text-[9px] font-bold uppercase tracking-wider">
                          {{ task.deadline }}
                        </span>
                      </div>

                      <!-- SUBTAREAS UI -->
                      <div class="pt-2 border-t border-slate-700/50 mt-1">
                        <div class="space-y-1 mb-1">
                          <!-- Lista Subtareas -->
                          <div *ngFor="let sub of task.subtasks" class="flex items-start gap-1 group/sub hover:bg-slate-700/30 p-1 rounded transition-colors relative">
                            <input type="checkbox" [checked]="sub.status === 'completed'" (change)="toggleSubtask(task, sub.id)" 
                                   class="mt-1 accent-blue-500 w-3 h-3 cursor-pointer shrink-0">
                            
                            <!-- COLOR PICKER SUBTAREA (Prioridad) -->
                            <div class="relative z-50 shrink-0 mt-1">
                              <div class="w-1.5 h-2 rounded-full cursor-pointer hover:scale-125 transition-transform"
                                   [style.background-color]="sub.color || '#64748b'"
                                   (click)="toggleColorPicker('sub_' + task.id + '_' + sub.id, $event)" title="Asignar prioridad"></div>
                              <div *ngIf="activeColorPicker() === 'sub_' + task.id + '_' + sub.id"
                                   class="absolute top-4 -left-2 bg-slate-800 border border-slate-600 rounded-lg p-1.5 shadow-2xl flex gap-1.5 w-auto z-50"
                                   (click)="$event.stopPropagation()">
                                <div *ngFor="let p of priorityPalette"
                                     class="w-4 h-4 rounded-full cursor-pointer hover:scale-110 border-2 border-transparent hover:border-white transition-all shadow-sm"
                                     [style.background-color]="p.color"
                                     [title]="'Prioridad: ' + p.label"
                                     (mousedown)="$event.preventDefault(); $event.stopPropagation()"
                                     (click)="setSubtaskColor(task, sub.id, p.color); activeColorPicker.set(null); $event.stopPropagation()"></div>
                              </div>
                            </div>

                            <!-- INPUT INLINE PARA SUBTAREA -->
                            <input type="text" [(ngModel)]="sub.text" (blur)="updateSubtask(task, sub.id, sub.text)"
                                   class="bg-transparent border-transparent focus:border-slate-600 focus:bg-slate-800/80 hover:bg-slate-800/50 rounded px-1 py-0 w-full text-xs md:text-[13px] font-medium leading-tight outline-none transition-colors text-ellipsis overflow-hidden whitespace-nowrap"
                                   [title]="sub.text"
                                   [style.color]="sub.status === 'completed' ? '#64748b' : (sub.color || '#cbd5e1')"
                                   [class.line-through]="sub.status === 'completed'"
                                   (keydown.enter)="$event.target.blur()">

                            <button (click)="deleteSubtask(task, sub.id)" class="text-slate-500 hover:text-red-400 opacity-0 group-hover/sub:opacity-100 transition-opacity p-0.5 shrink-0">
                              <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" fill="currentColor" viewBox="0 0 256 256"><path d="M216,48H176V40a24,24,0,0,0-24-24H104A24,24,0,0,0,80,40v8H40a8,8,0,0,0,0,16h8V208a16,16,0,0,0,16,16H192a16,16,0,0,0,16-16V64h8a8,8,0,0,0,0-16ZM96,40a8,8,0,0,1,8-8h48a8,8,0,0,1,8,8v8H96Zm96,168H64V64H192Z"></path></svg>
                            </button>
                          </div>
                        </div>
                        
                        <!-- Añadir Subtarea Input -->
                        <div class="flex items-center gap-1.5 opacity-60 hover:opacity-100 focus-within:opacity-100 transition-opacity px-1">
                          <span class="text-slate-500 text-xs font-bold">+</span>
                          <input #newSub type="text" placeholder="Añadir sub-tarea..." 
                                 class="flex-1 bg-transparent border-none text-xs text-slate-400 placeholder-slate-600 focus:ring-0 outline-none p-0"
                                 (keyup.enter)="addSubtask(task, newSub.value); newSub.value=''">
                        </div>
                      </div>

                    </div>

                    <!-- BOTÓN ELIMINAR TAREA PRINCIPAL -->
                    <button (click)="deleteTask(task)" class="opacity-100 lg:opacity-0 lg:group-hover/card:opacity-100 text-slate-600 hover:text-red-500 hover:bg-slate-700 rounded transition-all p-1.5 cursor-pointer">
                      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 256 256"><path d="M216,48H176V40a24,24,0,0,0-24-24H104A24,24,0,0,0,80,40v8H40a8,8,0,0,0,0,16h8V208a16,16,0,0,0,16,16H192a16,16,0,0,0,16-16V64h8a8,8,0,0,0,0-16ZM96,40a8,8,0,0,1,8-8h48a8,8,0,0,1,8,8v8H96Zm96,168H64V64H192Z"></path></svg>
                    </button>
                  </div>
                </div>

                <!-- DROPZONE VISUAL HELPER -->
                <div *ngIf="getTasksByCategory(col.id).length === 0" class="h-20 border-2 border-dashed border-slate-700/50 rounded-xl flex items-center justify-center text-slate-600 text-xs font-medium">
                  Soltar tarea aquí
                </div>

              </div>
            </div>
          </ng-container>

          <!-- BOTÓN AÑADIR NUEVA COLUMNA -->
          <div class="w-full lg:w-[300px] xl:w-[340px] shrink-0 flex flex-col justify-center items-center h-[120px] lg:h-[150px] border-2 border-dashed border-slate-700/50 hover:border-blue-500/50 hover:bg-slate-800/30 rounded-2xl cursor-pointer transition-all opacity-60 hover:opacity-100 mt-2 lg:mt-0" (click)="addNewColumn()">
            <span class="text-3xl mb-1 text-slate-500">+</span>
            <span class="text-[10px] md:text-xs font-bold uppercase tracking-widest text-slate-400">Nueva Lista</span>
          </div>

        </div>

        <!-- VISTA TIMELINE -->
        <div *ngIf="viewMode() === 'timeline'" class="max-w-3xl mx-auto space-y-4 md:space-y-6 py-4 md:py-8 px-2 md:px-0">
          <div *ngFor="let task of sortedTasks()" class="relative pl-6 md:pl-8 border-l-2 border-slate-700 pb-4 md:pb-6 last:pb-0">
            <div class="absolute -left-[9px] top-0 w-4 h-4 rounded-full border-[3px] border-[#0f172a]" [style.background-color]="getCategoryColor(task.category)"></div>
            
            <div class="bg-slate-800/40 p-3 md:p-4 rounded-xl border border-slate-700/50 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <div class="flex-1">
                <span class="text-[9px] md:text-[10px] font-black uppercase tracking-widest mb-1 block" [style.color]="getCategoryColor(task.category)">{{ getCategoryTitle(task.category) }}</span>
                <h3 class="text-sm md:text-base font-bold mb-1" [style.color]="task.color || '#ffffff'">{{ task.text }}</h3>
                <p class="text-slate-400 font-mono text-[10px]">{{ task.deadline || 'Sin fecha fija' }}</p>
              </div>
              <button (click)="toggleTask(task)" [class.bg-green-500]="task.status === 'completed'" class="w-8 h-8 rounded-lg border-2 border-slate-600 flex items-center justify-center shrink-0">
                <svg *ngIf="task.status === 'completed'" xmlns="http://www.w3.org/2000/svg" width="14" height="14" fill="#000" viewBox="0 0 256 256"><path d="M229.66,77.66l-128,128a8,8,0,0,1-11.32,0l-56-56a8,8,0,0,1,11.32-11.32L96,188.69,218.34,66.34a8,8,0,0,1,11.32,11.32Z"></path></svg>
              </button>
            </div>
          </div>
        </div>

      </main>

      <!-- AÑADIR RAPIDO INFERIOR -->
      <footer class="p-2 md:p-3 bg-slate-900 border-t border-slate-800 shrink-0">
        <div class="max-w-2xl mx-auto flex gap-2">
          <input #manualInput type="text" placeholder="Añadir tarea rápida por texto..." 
            class="flex-1 bg-slate-800 border-none rounded-lg px-3 py-2 text-xs md:text-sm focus:ring-1 focus:ring-blue-500 outline-none transition-all"
            (keyup.enter)="addManual(manualInput.value); manualInput.value = ''">
          <button (click)="addManual(manualInput.value); manualInput.value = ''" class="bg-blue-600 hover:bg-blue-500 px-4 rounded-lg font-bold transition-all text-xs">AÑADIR</button>
        </div>
      </footer>
    </div>
  `,
  styles: [`
    .custom-scrollbar::-webkit-scrollbar { width: 4px; height: 6px; }
    .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
    .custom-scrollbar::-webkit-scrollbar-thumb { background: #334155; border-radius: 10px; }
    .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #475569; }
    textarea { overflow: hidden; }
  `]
})
export class App implements OnInit {
  user = signal<User | null>(null);
  tasks = signal<Task[]>([]);
  columns = signal<Column[]>([]);
  isListening = signal<boolean>(false);
  isProcessingAI = signal<boolean>(false);
  statusMessage = signal<string>('');
  viewMode = signal<'kanban' | 'timeline'>('kanban');

  activeColorPicker = signal<string | null>(null);

  palette = [
    '#ef4444', '#f97316', '#eab308', '#22c55e', 
    '#06b6d4', '#3b82f6', '#8b5cf6', '#ec4899', 
    '#f43f5e', '#94a3b8'
  ];

  priorityPalette = [
    { color: '#22c55e', label: 'Baja' },     // Verde
    { color: '#f97316', label: 'Media' },    // Naranja
    { color: '#ef4444', label: 'Alta' }      // Rojo
  ];

  draggedTask: Task | null = null;

  private db: any;
  private auth: any;
  private recognition: any;

  @HostListener('document:click')
  onDocumentClick() {
    if (this.activeColorPicker() !== null) {
      this.activeColorPicker.set(null);
    }
  }

  ngOnInit() {
    this.initFirebase();
    this.initVoice();
  }

  private async initFirebase() {
    const config = JSON.parse(typeof __firebase_config !== 'undefined' ? __firebase_config : '{}');
    const app = initializeApp(config);
    this.auth = getAuth(app);
    this.db = getFirestore(app);

    if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
      await signInWithCustomToken(this.auth, __initial_auth_token);
    } else {
      await signInAnonymously(this.auth);
    }

    onAuthStateChanged(this.auth, (u) => {
      this.user.set(u);
      if (u) {
        this.listenColumns(u.uid);
        this.listenTasks(u.uid);
      }
    });
  }

  // --- LOGICA DE COLUMNAS DINAMICAS ---
  private listenColumns(uid: string) {
    const appId = typeof __app_id !== 'undefined' ? __app_id : 'default';
    const boardRef = doc(this.db, 'artifacts', appId, 'users', uid, 'settings', 'board');
    
    onSnapshot(boardRef, (snap) => {
      if (snap.exists() && snap.data()['columns']) {
        let cols: Column[] = snap.data()['columns'];
        
        // Garantizar que 'inbox' siempre exista y esté en la posición 0 (Lado Izquierdo)
        const inboxIndex = cols.findIndex(c => c.id === 'inbox');
        if (inboxIndex > 0) {
          const inbox = cols.splice(inboxIndex, 1)[0];
          cols.unshift(inbox); // Mover al principio
        } else if (inboxIndex === -1) {
          cols.unshift({ id: 'inbox', title: 'BANDEJA', color: '#94a3b8', locked: true });
        }
        
        this.columns.set(cols);
      } else {
        // Inicialización por defecto si no hay nada guardado
        const defaultCols: Column[] = [
          { id: 'inbox', title: 'BANDEJA', color: '#94a3b8', locked: true },
          { id: 'shellcatch', title: 'SHELLCATCH', color: '#f97316' },
          { id: 'docencia', title: 'U. CONTINENTAL', color: '#3b82f6' },
          { id: 'personal', title: 'PERSONAL/DOC', color: '#a855f7' }
        ];
        setDoc(boardRef, { columns: defaultCols });
      }
    });
  }

  async updateColumn(colId: string, newTitle: string) {
    if (!this.user() || !newTitle.trim()) return;
    const appId = typeof __app_id !== 'undefined' ? __app_id : 'default';
    const newCols = this.columns().map(c => c.id === colId ? { ...c, title: newTitle.trim() } : c);
    await setDoc(doc(this.db, 'artifacts', appId, 'users', this.user()!.uid, 'settings', 'board'), { columns: newCols }, { merge: true });
  }

  async addNewColumn() {
    if (!this.user()) return;
    const newId = 'list_' + Date.now().toString(36);
    const colors = ['#ef4444', '#f97316', '#eab308', '#22c55e', '#3b82f6', '#a855f7', '#ec4899', '#06b6d4'];
    const randomColor = colors[Math.floor(Math.random() * colors.length)];
    
    const newCols = [...this.columns(), { id: newId, title: 'NUEVA LISTA', color: randomColor }];
    const appId = typeof __app_id !== 'undefined' ? __app_id : 'default';
    await setDoc(doc(this.db, 'artifacts', appId, 'users', this.user()!.uid, 'settings', 'board'), { columns: newCols }, { merge: true });
  }

  async deleteColumn(colId: string) {
    if (!this.user() || colId === 'inbox') return; // Inbox no se borra
    const appId = typeof __app_id !== 'undefined' ? __app_id : 'default';
    
    // 1. Borrar de la lista de columnas
    const newCols = this.columns().filter(c => c.id !== colId);
    await setDoc(doc(this.db, 'artifacts', appId, 'users', this.user()!.uid, 'settings', 'board'), { columns: newCols }, { merge: true });

    // 2. Mover tareas de la lista borrada a la Bandeja
    const tasksToMove = this.tasks().filter(t => t.category === colId);
    for (let t of tasksToMove) {
      if (t.id) await this.updateTask(t.id, { category: 'inbox' });
    }
  }

  toggleColorPicker(id: string, event: Event) {
    event.stopPropagation();
    this.activeColorPicker.set(this.activeColorPicker() === id ? null : id);
  }

  async setColumnColor(col: Column, color: string) {
    if (!this.user()) return;
    const appId = typeof __app_id !== 'undefined' ? __app_id : 'default';
    const newCols = this.columns().map(c => c.id === col.id ? { ...c, color } : c);
    await setDoc(doc(this.db, 'artifacts', appId, 'users', this.user()!.uid, 'settings', 'board'), { columns: newCols }, { merge: true });
  }

  getCategoryColor(catId: string) {
    return this.columns().find(c => c.id === catId)?.color || '#94a3b8';
  }

  getCategoryTitle(catId: string) {
    return this.columns().find(c => c.id === catId)?.title || 'DESCONOCIDO';
  }

  // --- LOGICA DE TAREAS ---
  private listenTasks(uid: string) {
    const appId = typeof __app_id !== 'undefined' ? __app_id : 'default';
    const tasksRef = collection(this.db, 'artifacts', appId, 'users', uid, 'tasks');
    
    onSnapshot(tasksRef, (snap) => {
      const list: Task[] = [];
      snap.forEach(d => list.push({ id: d.id, ...d.data() } as Task));
      
      list.sort((a, b) => {
        if (a.status === 'completed' && b.status !== 'completed') return 1;
        if (a.status !== 'completed' && b.status === 'completed') return -1;
        return b.createdAt - a.createdAt;
      });
      
      this.tasks.set(list);
    });
  }

  getTasksByCategory(cat: string) {
    return this.tasks().filter(t => t.category === cat);
  }

  sortedTasks() {
    return [...this.tasks()]; 
  }

  async updateTask(taskId: string, updates: any) {
    if (!this.user()) return;
    const appId = typeof __app_id !== 'undefined' ? __app_id : 'default';
    await updateDoc(doc(this.db, 'artifacts', appId, 'users', this.user()!.uid, 'tasks', taskId), updates);
  }

  async setTaskColor(task: Task, color: string) {
    if (!task.id) return;
    await this.updateTask(task.id, { color });
  }

  async toggleTask(t: Task) { 
    await this.updateTask(t.id!, { status: t.status === 'pending' ? 'completed' : 'pending' }); 
  }
  
  async deleteTask(t: Task) { 
    const appId = typeof __app_id !== 'undefined' ? __app_id : 'default';
    await deleteDoc(doc(this.db, 'artifacts', appId, 'users', this.user()!.uid, 'tasks', t.id!)); 
  }

  // --- SUBTAREAS ---
  async addSubtask(task: Task, text: string) {
    if (!text.trim() || !this.user() || !task.id) return;
    const newId = Date.now().toString(36);
    const newSubtask: SubTask = { id: newId, text: text.trim(), status: 'pending' };
    const subtasks = task.subtasks ? [...task.subtasks, newSubtask] : [newSubtask];
    await this.updateTask(task.id, { subtasks });
  }

  async updateSubtask(task: Task, subId: string, newText: string) {
    if (!task.id || !task.subtasks || !newText.trim()) return;
    const subtasks = task.subtasks.map(s => s.id === subId ? { ...s, text: newText.trim() } : s);
    await this.updateTask(task.id, { subtasks });
  }

  async setSubtaskColor(task: Task, subId: string, color: string) {
    if (!task.id || !task.subtasks) return;
    const subtasks = task.subtasks.map(s => s.id === subId ? { ...s, color } : s);
    await this.updateTask(task.id, { subtasks });
  }

  async toggleSubtask(task: Task, subId: string) {
    if (!task.id || !task.subtasks) return;
    const subtasks = task.subtasks.map(s => s.id === subId ? { ...s, status: s.status === 'pending' ? 'completed' : 'pending' } : s);
    await this.updateTask(task.id, { subtasks });
  }

  async deleteSubtask(task: Task, subId: string) {
    if (!task.id || !task.subtasks) return;
    const subtasks = task.subtasks.filter(s => s.id !== subId);
    await this.updateTask(task.id, { subtasks });
  }

  // --- DRAG AND DROP ---
  onDragStart(task: Task) { this.draggedTask = task; }
  onDragOver(event: DragEvent) { event.preventDefault(); }
  onDragOverTask(event: DragEvent) { event.preventDefault(); event.stopPropagation(); }

  async onDrop(event: DragEvent, targetCategory: string, targetTask?: Task) {
    event.preventDefault();
    if (!this.draggedTask || !this.draggedTask.id || !this.user()) return;
    if (this.draggedTask.id === targetTask?.id) { this.draggedTask = null; return; }

    const updates: any = {};
    if (this.draggedTask.category !== targetCategory) {
      updates.category = targetCategory;
    }

    if (targetTask && targetTask.createdAt) {
      updates.createdAt = targetTask.createdAt + 10;
    } else if (!targetTask && this.draggedTask.category !== targetCategory) {
       updates.createdAt = Date.now();
    }

    if (Object.keys(updates).length > 0) {
      await this.updateTask(this.draggedTask.id, updates);
    }
    this.draggedTask = null;
  }

  // --- IA Y VOZ ---
  private initVoice() {
    const SR = (window as any).webkitSpeechRecognition || (window as any).SpeechRecognition;
    if (SR) {
      this.recognition = new SR();
      this.recognition.lang = 'es-ES';
      this.recognition.onresult = (e: any) => this.processAI(e.results[0][0].transcript);
      this.recognition.onend = () => this.isListening.set(false);
    }
  }

  toggleListening() {
    if (this.isListening()) this.recognition.stop();
    else {
      this.recognition.start();
      this.isListening.set(true);
      this.statusMessage.set('Escuchando instrucción...');
    }
  }

  private async processAI(transcript: string) {
    this.isProcessingAI.set(true);
    this.statusMessage.set('IA Analizando: ' + transcript);
    
    try {
      // Pasamos las listas dinámicas a la IA para que aprenda dónde meter cada tarea
      const categoriesInfo = this.columns().map(c => ({ id: c.id, name: c.title }));
      
      const prompt = `Analiza este audio: "${transcript}".
      Las categorías (listas) actuales del usuario son: ${JSON.stringify(categoriesInfo)}.
      Tu misión es clasificar la tarea y devolver un JSON con la siguiente estructura: 
      {"text": "resumen muy corto de la tarea", "category": "ID_DE_LA_CATEGORIA", "deadline": "fecha límite corta o null"}.
      Si no sabes en qué categoría encaja, devuélvelo a la category "inbox".`;
      
      const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-09-2025:generateContent?key=`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { responseMimeType: "application/json" }
        })
      });

      const data = await res.json();
      const ai = JSON.parse(data.candidates[0].content.parts[0].text);
      
      // Validar si la categoría de la IA existe realmente, si alucina algo raro, va a Inbox
      const isValidCat = this.columns().some(c => c.id === ai.category);
      await this.save(ai.text, isValidCat ? ai.category : 'inbox', ai.deadline);
      
      this.statusMessage.set('Tarea asignada automáticamente a: ' + this.getCategoryTitle(ai.category));
    } catch (e) {
      await this.save(transcript, 'inbox', null);
      this.statusMessage.set('Guardado rápido en Bandeja.');
    } finally {
      this.isProcessingAI.set(false);
      setTimeout(() => this.statusMessage.set(''), 4000);
    }
  }

  private async save(text: string, category: string, deadline: string | null) {
    if (!this.user()) return;
    const appId = typeof __app_id !== 'undefined' ? __app_id : 'default';
    await addDoc(collection(this.db, 'artifacts', appId, 'users', this.user()!.uid, 'tasks'), {
      text,
      category,
      deadline,
      status: 'pending',
      subtasks: [],
      createdAt: Date.now()
    });
  }

  async addManual(txt: string) { if(txt.trim()) await this.save(txt, 'inbox', null); }
}
