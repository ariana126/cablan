import { DependentsProbe } from '@framework/application';
import { Injectable } from '@nestjs/common';
import { DiscoveryService } from '@nestjs/core';

import { DiscoveredProviders } from './discovered-providers';

/**
 * Every `DependentsProbe` provider in the application (issue #94), found and
 * guarded as `DiscoveredProviders` describes.
 */
@Injectable()
export class DiscoveredDependentsProbes extends DiscoveredProviders<DependentsProbe> {
  constructor(discovery: DiscoveryService) {
    super(discovery, DependentsProbe, 'DependentsProbe');
  }
}
