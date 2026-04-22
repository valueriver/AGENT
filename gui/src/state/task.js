import { reactive } from "vue";

export const taskState = reactive({
  currentId: null,
  current: null,
});

export const setCurrentTask = (id, task = null) => {
  taskState.currentId = id == null ? null : id;
  taskState.current = task;
};

export const clearCurrentTask = () => {
  taskState.currentId = null;
  taskState.current = null;
};
