import * as dnd from '@dnd-kit/core';
const exports = ['DndContext', 'closestCenter', 'KeyboardSensor', 'PointerSensor', 'useSensor', 'useSensors', 'TouchSensor'];
exports.forEach(e => {
  if (!(dnd as any)[e]) console.log('Missing dnd:', e);
});
import * as sortable from '@dnd-kit/sortable';
const sortableExports = ['arrayMove', 'SortableContext', 'sortableKeyboardCoordinates', 'rectSortingStrategy', 'useSortable'];
sortableExports.forEach(e => {
  if (!(sortable as any)[e]) console.log('Missing sortable:', e);
});
import * as utils from '@dnd-kit/utilities';
console.log('CSS:', !!utils.CSS);
