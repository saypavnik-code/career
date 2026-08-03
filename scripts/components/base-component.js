export function defineComponent({ mount, update, destroy }) {
  return {
    mount(container, props) {
      const instance = mount(container, props);
      return { container, ...instance };
    },
    update(instance, props) { if (update) update(instance, props); },
    destroy(instance) { if (destroy) destroy(instance); },
  };
}
