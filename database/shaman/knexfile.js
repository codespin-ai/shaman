import { createDbConfig } from '../../knexfile.js';

// Shaman database configuration
export default createDbConfig('shaman', {
  // Any shaman-specific overrides can go here
  // For example:
  // pool: {
  //   min: 5,
  //   max: 20
  // }
});