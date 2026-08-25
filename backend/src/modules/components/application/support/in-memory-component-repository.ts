import { Component } from '@components/domain/component.aggregate';
import { ComponentRepository } from '@components/domain/service/component.repository';
import { ComponentName } from '@components/domain/value/component-name.vo';
import { EntityNotFound, Identity } from '@framework/domain';

// A hand-written fake, not a mock: `ComponentRepository` is an in-process
// collaborator from a handler's point of view, so tests use a real (if
// simplified) implementation rather than asserting on calls made to it.
export class InMemoryComponentRepository extends ComponentRepository {
  private readonly componentsById = new Map<string, Component>();

  find(id: Identity): Promise<Component | null> {
    return Promise.resolve(this.componentsById.get(id.asString()) ?? null);
  }

  async get(id: Identity): Promise<Component> {
    const component = await this.find(id);
    if (!component) {
      throw EntityNotFound.withId(id);
    }
    return component;
  }

  save(entity: Component): Promise<void> {
    this.componentsById.set(entity.id.asString(), entity);
    entity.releaseEvents();
    return Promise.resolve();
  }

  delete(component: Component): Promise<void> {
    this.componentsById.delete(component.id.asString());
    component.releaseEvents();
    return Promise.resolve();
  }

  findByName(name: ComponentName): Promise<Component | null> {
    for (const component of this.componentsById.values()) {
      if (component.name().equals(name)) return Promise.resolve(component);
    }
    return Promise.resolve(null);
  }

  list(): Promise<Component[]> {
    return Promise.resolve([...this.componentsById.values()]);
  }

  seed(component: Component): Component {
    this.componentsById.set(component.id.asString(), component);
    component.releaseEvents();
    return component;
  }
}
