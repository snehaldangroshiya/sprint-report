// Advanced performance monitoring and optimization system

import { EventEmitter } from 'events';

export interface PerformanceMetric {
  name: string;
  value: number;
  unit: 'ms' | 'bytes' | 'count' | 'percentage';
  timestamp: number;
  tags: Record<string, string>;
  context?: Record<string, any>;
}

export interface PerformanceSnapshot {
  timestamp: number;
  duration: number;
  memory: {
    used: number;
    free: number;
    total: number;
    heapUsed: number;
    heapTotal: number;
  };
  cache: {
    hitRate: number;
    operations: number;
    errors: number;
  };
  operations: {
    total: number;
    successful: number;
    failed: number;
    averageLatency: number;
  };
  services: {
    jira: ServiceHealth;
    github: ServiceHealth;
    cache: ServiceHealth;
  };
}

export interface ServiceHealth {
  status: 'healthy' | 'degraded' | 'unhealthy';
  latency: number;
  errorRate: number;
  lastError?: string;
  consecutiveErrors: number;
}

export interface AlertRule {
  name: string;
  condition: (metrics: PerformanceSnapshot) => boolean;
  severity: 'info' | 'warning' | 'error' | 'critical';
  message: string;
  cooldown: number; // Minimum time between alerts in ms
  enabled: boolean;
}

export class PerformanceMonitor extends EventEmitter {
  private metrics: Map<string, PerformanceMetric[]> = new Map();
  private snapshots: PerformanceSnapshot[] = [];
  private operations: Map<string, { startTime: number; duration?: number; success?: boolean }> = new Map();
  private alertRules: AlertRule[] = [];
  private lastAlerts: Map<string, number> = new Map();
  private monitoringInterval?: NodeJS.Timeout;

  private readonly maxMetricsPerType = 1000;
  private readonly maxSnapshots = 100;
  private readonly snapshotInterval = 30000; // 30 seconds

  constructor() {
    super();
    this.setupDefaultAlertRules();
    this.startMonitoring();
  }

  private setupDefaultAlertRules(): void {
    this.addAlertRule({
      name: 'high-memory-usage',
      condition: (snapshot) => (snapshot.memory.heapUsed / snapshot.memory.heapTotal) > 0.85,
      severity: 'warning',
      message: 'High memory usage detected: {heapUsed}MB/{heapTotal}MB ({percentage}%)',
      cooldown: 300000, // 5 minutes
      enabled: true
    });

    this.addAlertRule({
      name: 'low-cache-hit-rate',
      condition: (snapshot) => snapshot.cache.hitRate < 0.5 && snapshot.cache.operations > 100,
      severity: 'warning',
      message: 'Low cache hit rate: {hitRate}% with {operations} operations',
      cooldown: 600000, // 10 minutes
      enabled: true
    });

    this.addAlertRule({
      name: 'high-error-rate',
      condition: (snapshot) => snapshot.operations.total > 50 && (snapshot.operations.failed / snapshot.operations.total) > 0.1,
      severity: 'error',
      message: 'High error rate: {failed}/{total} operations failed ({errorRate}%)',
      cooldown: 300000, // 5 minutes
      enabled: true
    });

    this.addAlertRule({
      name: 'service-degraded',
      condition: (snapshot) => Object.values(snapshot.services).some(service => service.status === 'degraded'),
      severity: 'warning',
      message: 'Service degradation detected: {services}',
      cooldown: 600000, // 10 minutes
      enabled: true
    });

    this.addAlertRule({
      name: 'service-unhealthy',
      condition: (snapshot) => Object.values(snapshot.services).some(service => service.status === 'unhealthy'),
      severity: 'critical',
      message: 'Service unhealthy: {services}',
      cooldown: 180000, // 3 minutes
      enabled: true
    });

    this.addAlertRule({
      name: 'high-average-latency',
      condition: (snapshot) => snapshot.operations.averageLatency > 2000 && snapshot.operations.total > 10,
      severity: 'warning',
      message: 'High average latency: {latency}ms with {operations} operations',
      cooldown: 300000, // 5 minutes
      enabled: true
    });
  }

  public recordMetric(name: string, value: number, unit: PerformanceMetric['unit'], tags: Record<string, string> = {}, context?: Record<string, any>): void {
    const metric: PerformanceMetric = {
      name,
      value,
      unit,
      timestamp: Date.now(),
      tags
    };

    if (context) {
      metric.context = context;
    }

    if (!this.metrics.has(name)) {
      this.metrics.set(name, []);
    }

    const metricArray = this.metrics.get(name)!;
    metricArray.push(metric);

    // Limit memory usage by keeping only recent metrics
    if (metricArray.length > this.maxMetricsPerType) {
      metricArray.splice(0, metricArray.length - this.maxMetricsPerType);
    }

    this.emit('metric', metric);
  }

  public startOperation(operationId: string): void {
    this.operations.set(operationId, {
      startTime: Date.now()
    });
  }

  public endOperation(operationId: string, success: boolean = true): number {
    const operation = this.operations.get(operationId);
    if (!operation) {
      return 0;
    }

    const duration = Date.now() - operation.startTime;
    operation.duration = duration;
    operation.success = success;

    this.recordMetric('operation.duration', duration, 'ms', {
      operation: operationId,
      success: success.toString()
    });

    this.recordMetric('operation.count', 1, 'count', {
      operation: operationId,
      success: success.toString()
    });

    this.operations.delete(operationId);
    return duration;
  }

  public measureAsync<T>(operationName: string, operation: () => Promise<T>): Promise<T> {
    const operationId = `${operationName}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    this.startOperation(operationId);

    return operation()
      .then(result => {
        this.endOperation(operationId, true);
        return result;
      })
      .catch(error => {
        this.endOperation(operationId, false);
        throw error;
      });
  }

  public measureSync<T>(operationName: string, operation: () => T): T {
    const operationId = `${operationName}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    this.startOperation(operationId);

    try {
      const result = operation();
      this.endOperation(operationId, true);
      return result;
    } catch (error) {
      this.endOperation(operationId, false);
      throw error;
    }
  }

  public createSnapshot(cacheStats: any, serviceHealths: Record<string, ServiceHealth>): PerformanceSnapshot {
    const now = Date.now();
    const memInfo = process.memoryUsage();

    // Calculate operation metrics from recent metrics
    const operationMetrics = this.calculateOperationMetrics();

    const snapshot: PerformanceSnapshot = {
      timestamp: now,
      duration: this.snapshotInterval,
      memory: {
        used: memInfo.rss,
        free: 0, // Node.js doesn't provide this directly
        total: memInfo.rss + memInfo.external,
        heapUsed: memInfo.heapUsed,
        heapTotal: memInfo.heapTotal
      },
      cache: {
        hitRate: cacheStats?.hitRate || 0,
        operations: (cacheStats?.hits || 0) + (cacheStats?.misses || 0),
        errors: cacheStats?.errors || 0
      },
      operations: operationMetrics,
      services: {
        jira: serviceHealths.jira || { status: 'unhealthy', latency: 0, errorRate: 0, consecutiveErrors: 0 },
        github: serviceHealths.github || { status: 'unhealthy', latency: 0, errorRate: 0, consecutiveErrors: 0 },
        cache: serviceHealths.cache || { status: 'unhealthy', latency: 0, errorRate: 0, consecutiveErrors: 0 }
      }
    };

    this.snapshots.push(snapshot);

    // Limit memory usage
    if (this.snapshots.length > this.maxSnapshots) {
      this.snapshots.splice(0, this.snapshots.length - this.maxSnapshots);
    }

    // Check alert rules
    this.checkAlerts(snapshot);

    this.emit('snapshot', snapshot);
    return snapshot;
  }

  private calculateOperationMetrics(): PerformanceSnapshot['operations'] {
    const recentTime = Date.now() - this.snapshotInterval;
    const operationDurations = this.getMetricsSince('operation.duration', recentTime);
    const operationCounts = this.getMetricsSince('operation.count', recentTime);

    const successful = operationCounts.filter(m => m.tags.success === 'true').length;
    const failed = operationCounts.filter(m => m.tags.success === 'false').length;
    const total = successful + failed;

    const averageLatency = operationDurations.length > 0
      ? operationDurations.reduce((sum, m) => sum + m.value, 0) / operationDurations.length
      : 0;

    return {
      total,
      successful,
      failed,
      averageLatency
    };
  }

  private getMetricsSince(metricName: string, timestamp: number): PerformanceMetric[] {
    const metrics = this.metrics.get(metricName);
    if (!metrics) return [];

    return metrics.filter(m => m.timestamp >= timestamp);
  }

  private checkAlerts(snapshot: PerformanceSnapshot): void {
    for (const rule of this.alertRules) {
      if (!rule.enabled) continue;

      const lastAlert = this.lastAlerts.get(rule.name) || 0;
      if (Date.now() - lastAlert < rule.cooldown) continue;

      if (rule.condition(snapshot)) {
        const formattedMessage = this.formatAlertMessage(rule.message, snapshot);

        this.emit('alert', {
          rule: rule.name,
          severity: rule.severity,
          message: formattedMessage,
          timestamp: Date.now(),
          snapshot
        });

        this.lastAlerts.set(rule.name, Date.now());
      }
    }
  }

  private formatAlertMessage(template: string, snapshot: PerformanceSnapshot): string {
    return template
      .replace('{heapUsed}', Math.round(snapshot.memory.heapUsed / 1024 / 1024).toString())
      .replace('{heapTotal}', Math.round(snapshot.memory.heapTotal / 1024 / 1024).toString())
      .replace('{percentage}', Math.round((snapshot.memory.heapUsed / snapshot.memory.heapTotal) * 100).toString())
      .replace('{hitRate}', Math.round(snapshot.cache.hitRate).toString())
      .replace('{operations}', snapshot.cache.operations.toString())
      .replace('{failed}', snapshot.operations.failed.toString())
      .replace('{total}', snapshot.operations.total.toString())
      .replace('{errorRate}', Math.round((snapshot.operations.failed / snapshot.operations.total) * 100).toString())
      .replace('{latency}', Math.round(snapshot.operations.averageLatency).toString())
      .replace('{services}', Object.entries(snapshot.services)
        .filter(([_, health]) => health.status !== 'healthy')
        .map(([name, health]) => `${name}:${health.status}`)
        .join(', '));
  }

  public addAlertRule(rule: AlertRule): void {
    this.alertRules.push(rule);
  }

  public removeAlertRule(name: string): boolean {
    const index = this.alertRules.findIndex(rule => rule.name === name);
    if (index >= 0) {
      this.alertRules.splice(index, 1);
      return true;
    }
    return false;
  }

  public enableAlertRule(name: string): void {
    const rule = this.alertRules.find(r => r.name === name);
    if (rule) rule.enabled = true;
  }

  public disableAlertRule(name: string): void {
    const rule = this.alertRules.find(r => r.name === name);
    if (rule) rule.enabled = false;
  }

  private startMonitoring(): void {
    // This would be triggered by the main application with real data
    // For now, we just set up the interval infrastructure
    this.monitoringInterval = setInterval(() => {
      // In a real implementation, this would collect current stats
      // and call createSnapshot with real data
    }, this.snapshotInterval);
  }

  public getRecentSnapshots(count: number = 10): PerformanceSnapshot[] {
    return this.snapshots.slice(-count);
  }

  public getMetricHistory(metricName: string, limit: number = 100): PerformanceMetric[] {
    const metrics = this.metrics.get(metricName);
    if (!metrics) return [];

    return metrics.slice(-limit);
  }

  public getPerformanceSummary(): {
    metrics: Record<string, { count: number; average: number; min: number; max: number }>;
    alerts: { total: number; byRule: Record<string, number>; bySeverity: Record<string, number> };
    uptime: number;
    memoryTrend: 'increasing' | 'decreasing' | 'stable';
    cacheHitRate?: number;
  } {
    const summary: any = {
      metrics: {},
      alerts: { total: 0, byRule: {}, bySeverity: {} },
      uptime: process.uptime() * 1000,
      memoryTrend: 'stable'
    };

    // Calculate metric summaries
    for (const [name, metrics] of this.metrics.entries()) {
      if (metrics.length === 0) continue;

      const values = metrics.map(m => m.value);
      summary.metrics[name] = {
        count: values.length,
        average: values.reduce((sum, v) => sum + v, 0) / values.length,
        min: Math.min(...values),
        max: Math.max(...values)
      };
    }

    // Calculate memory trend
    const recentSnapshots = this.snapshots.slice(-10);
    if (recentSnapshots.length > 5) {
      const firstHalf = recentSnapshots.slice(0, 5);
      const secondHalf = recentSnapshots.slice(-5);

      const firstAvg = firstHalf.reduce((sum, s) => sum + s.memory.heapUsed, 0) / firstHalf.length;
      const secondAvg = secondHalf.reduce((sum, s) => sum + s.memory.heapUsed, 0) / secondHalf.length;

      const percentChange = (secondAvg - firstAvg) / firstAvg;

      if (percentChange > 0.05) summary.memoryTrend = 'increasing';
      else if (percentChange < -0.05) summary.memoryTrend = 'decreasing';
    }

    // Add cache hit rate from most recent snapshot
    if (this.snapshots.length > 0) {
      const latestSnapshot = this.snapshots[this.snapshots.length - 1];
      if (latestSnapshot) {
        summary.cacheHitRate = latestSnapshot.cache.hitRate; // Already in percentage format
      }
    }

    return summary;
  }

  public exportMetrics(format: 'json' | 'csv' = 'json'): string {
    if (format === 'csv') {
      const allMetrics: PerformanceMetric[] = [];
      for (const metrics of this.metrics.values()) {
        allMetrics.push(...metrics);
      }

      allMetrics.sort((a, b) => a.timestamp - b.timestamp);

      const headers = ['timestamp', 'name', 'value', 'unit', 'tags'];
      const rows = allMetrics.map(m => [
        new Date(m.timestamp).toISOString(),
        m.name,
        m.value.toString(),
        m.unit,
        JSON.stringify(m.tags)
      ]);

      return [headers, ...rows].map(row => row.join(',')).join('\n');
    }

    return JSON.stringify({
      metrics: Object.fromEntries(this.metrics.entries()),
      snapshots: this.snapshots,
      summary: this.getPerformanceSummary()
    }, null, 2);
  }

  public cleanup(): void {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
    }

    this.metrics.clear();
    this.snapshots.length = 0;
    this.operations.clear();
    this.lastAlerts.clear();
    this.removeAllListeners();
  }
}

// Performance decorator for automatic operation measurement
export function measurePerformance(operationName?: string) {
  return function(target: any, propertyKey: string, descriptor: PropertyDescriptor) {
    const originalMethod = descriptor.value;
    const opName = operationName || `${target.constructor.name}.${propertyKey}`;

    descriptor.value = function(...args: any[]) {
      const monitor = (this as any).performanceMonitor || globalPerformanceMonitor;
      if (!monitor) {
        return originalMethod.apply(this, args);
      }

      const operationId = `${opName}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      monitor.startOperation(operationId);

      try {
        const result = originalMethod.apply(this, args);

        if (result && typeof result.then === 'function') {
          // Async method
          return result
            .then((value: any) => {
              monitor.endOperation(operationId, true);
              return value;
            })
            .catch((error: any) => {
              monitor.endOperation(operationId, false);
              throw error;
            });
        } else {
          // Sync method
          monitor.endOperation(operationId, true);
          return result;
        }
      } catch (error) {
        monitor.endOperation(operationId, false);
        throw error;
      }
    };

    return descriptor;
  };
}

// Global performance monitor instance
export let globalPerformanceMonitor: PerformanceMonitor | null = null;

export function initializeGlobalPerformanceMonitor(): PerformanceMonitor {
  if (!globalPerformanceMonitor) {
    globalPerformanceMonitor = new PerformanceMonitor();
  }
  return globalPerformanceMonitor;
}

export function getGlobalPerformanceMonitor(): PerformanceMonitor | null {
  return globalPerformanceMonitor;
}
