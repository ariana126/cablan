import { CompositionOrderPropagator } from '@framework/application';
import { Injectable } from '@nestjs/common';
import { DiscoveryService } from '@nestjs/core';

import { DiscoveredProviders } from './discovered-providers';

/**
 * Every `CompositionOrderPropagator` provider in the application (issue
 * #122), found and guarded the same way as the dependents probes and the
 * correction propagators.
 */
@Injectable()
export class DiscoveredCompositionOrderPropagators extends DiscoveredProviders<CompositionOrderPropagator> {
  constructor(discovery: DiscoveryService) {
    super(discovery, CompositionOrderPropagator, 'CompositionOrderPropagator');
  }
}
