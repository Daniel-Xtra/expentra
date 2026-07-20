export type WithJobCorrelation<T> = T & {
  correlationId?: string;
};
