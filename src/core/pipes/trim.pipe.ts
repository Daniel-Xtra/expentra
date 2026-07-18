import { Injectable, PipeTransform } from '@nestjs/common';

@Injectable()
export class TrimPipe implements PipeTransform {
  // Generic transform that preserves the input type
  transform<T>(value: T): T {
    // Only process objects (including arrays) – primitives are returned unchanged
    if (value && typeof value === 'object') {
      this.trimStrings(value);
    }
    return value;
  }

  /**
   * Recursively trim string properties on an unknown value.
   * The function mutates objects in‑place to keep the original reference.
   */
  private trimStrings(value: unknown): void {
    if (Array.isArray(value)) {
      // Trim each element of an array
      for (const item of value) {
        this.trimStrings(item);
      }
      return;
    }

    if (value && typeof value === 'object') {
      // Treat the object as a dictionary of unknown values
      const obj = value as Record<string, unknown>;
      for (const key of Object.keys(obj)) {
        const prop = obj[key];
        if (typeof prop === 'string') {
          obj[key] = prop.trim();
        } else {
          // Recurse for nested objects/arrays
          this.trimStrings(prop);
        }
      }
    }
  }
}
