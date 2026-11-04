import { CorrectionPropagator } from '@framework/application';
import { Injectable } from '@nestjs/common';
import { DiscoveryService } from '@nestjs/core';

import { DiscoveredProviders } from './discovered-providers';

/**
 * Every `CorrectionPropagator` provider in the application (issue #110),
 * found and guarded the same way as the dependents probes.
 */
@Injectable()
export class DiscoveredCorrectionPropagators extends DiscoveredProviders<CorrectionPropagator> {
  constructor(discovery: DiscoveryService) {
    super(discovery, CorrectionPropagator, 'CorrectionPropagator');
  }
}
