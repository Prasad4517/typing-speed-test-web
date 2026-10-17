'use client';

import {
  Line,
  LineChart as RechartsLineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import styles from './LineChart.module.scss';

/** @param {{ data: Array<Record<string, any>>, dataKey?: string, xKey?: string, height?: number }} props */
export function LineChart({
  data,
  dataKey = 'wpm',
  xKey = 'createdAt',
  height = 240,
}) {
  return (
    <div className={styles.chart} style={{ height }}>
      <ResponsiveContainer height="100%" width="100%">
        <RechartsLineChart
          data={data}
          margin={{ top: 12, right: 8, left: -25, bottom: 0 }}
        >
          <XAxis
            dataKey={xKey}
            tick={{ fill: 'var(--text-subtle)', fontSize: 10 }}
          />
          <YAxis
            tick={{ fill: 'var(--text-subtle)', fontSize: 10 }}
            width={35}
          />
          <Tooltip
            contentStyle={{
              background: 'var(--dark-surface)',
              border: '1px solid var(--border-strong)',
              color: 'var(--surface)',
            }}
          />
          <Line
            dataKey={dataKey}
            dot={{ fill: 'var(--accent)', r: 4 }}
            stroke="var(--accent)"
            strokeWidth={2}
            type="monotone"
          />
        </RechartsLineChart>
      </ResponsiveContainer>
    </div>
  );
}
