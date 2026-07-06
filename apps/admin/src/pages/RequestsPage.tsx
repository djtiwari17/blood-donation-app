import React, { useState } from 'react';
import { Table, Tag, Select, Space, Typography, Progress } from 'antd';
import { useQuery } from '@tanstack/react-query';
import dayjs from 'dayjs';
import { adminApi, type AdminRequest } from '../api/admin.api';

const { Title } = Typography;

const STATUS_COLORS: Record<string, string> = {
  PENDING: 'blue', PARTIALLY_FULFILLED: 'gold',
  FULFILLED: 'green', EXPIRED: 'default', CANCELLED: 'red',
};

const URGENCY_COLORS: Record<string, string> = {
  CRITICAL: 'red', HIGH: 'orange', MEDIUM: 'gold', LOW: 'default',
};

export default function RequestsPage() {
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState<string>('');

  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'requests', page, statusFilter],
    queryFn: () => adminApi.getRequests(page, statusFilter || undefined),
    placeholderData: (prev) => prev,
  });

  const columns = [
    {
      title: 'Code',
      dataIndex: 'requestCode',
      key: 'requestCode',
      render: (v: string) => <code style={{ fontSize: 12 }}>{v}</code>,
    },
    {
      title: 'Patient',
      dataIndex: 'patientName',
      key: 'patient',
      render: (name: string, row: AdminRequest) => (
        <div>
          <div style={{ fontWeight: 600 }}>{name}</div>
          <div style={{ color: '#888', fontSize: 12 }}>{row.hospitalName}</div>
        </div>
      ),
    },
    {
      title: 'Receiver',
      key: 'receiver',
      render: (_: unknown, row: AdminRequest) => (
        <div>
          <div>{row.receiver.name}</div>
          <div style={{ color: '#888', fontSize: 12 }}>{row.receiver.phone}</div>
        </div>
      ),
    },
    {
      title: 'Blood',
      dataIndex: 'bloodGroup',
      key: 'bloodGroup',
      render: (v: string) => <Tag color="red">{v}</Tag>,
    },
    {
      title: 'Urgency',
      dataIndex: 'urgency',
      key: 'urgency',
      render: (v: string) => <Tag color={URGENCY_COLORS[v] ?? 'default'}>{v}</Tag>,
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      render: (v: string) => <Tag color={STATUS_COLORS[v] ?? 'default'}>{v.replace('_', ' ')}</Tag>,
    },
    {
      title: 'Units',
      key: 'units',
      render: (_: unknown, row: AdminRequest) => (
        <Space direction="vertical" size={2} style={{ width: 80 }}>
          <span style={{ fontSize: 12 }}>{row.unitsFulfilled}/{row.unitsNeeded}</span>
          <Progress
            percent={Math.round((row.unitsFulfilled / row.unitsNeeded) * 100)}
            size="small"
            showInfo={false}
            strokeColor={row.unitsFulfilled >= row.unitsNeeded ? '#27ae60' : '#c0392b'}
          />
        </Space>
      ),
    },
    {
      title: 'Matches',
      dataIndex: 'totalMatches',
      key: 'totalMatches',
      render: (n: number) => n,
    },
    {
      title: 'Required By',
      dataIndex: 'requiredBy',
      key: 'requiredBy',
      render: (v: string) => {
        const isPast = dayjs(v).isBefore(dayjs());
        return <span style={{ color: isPast ? '#e74c3c' : undefined }}>{dayjs(v).format('DD MMM, HH:mm')}</span>;
      },
    },
    {
      title: 'Created',
      dataIndex: 'createdAt',
      key: 'createdAt',
      render: (v: string) => dayjs(v).format('DD MMM YYYY'),
    },
  ];

  return (
    <div>
      <Title level={4} style={{ marginBottom: 16 }}>Blood Requests</Title>

      <Space style={{ marginBottom: 16 }}>
        <Select
          placeholder="Filter by status"
          style={{ width: 200 }}
          allowClear
          value={statusFilter || undefined}
          onChange={v => { setStatusFilter(v ?? ''); setPage(1); }}
          options={[
            { value: 'PENDING',              label: 'Pending' },
            { value: 'PARTIALLY_FULFILLED',  label: 'Partially Fulfilled' },
            { value: 'FULFILLED',            label: 'Fulfilled' },
            { value: 'EXPIRED',              label: 'Expired' },
            { value: 'CANCELLED',            label: 'Cancelled' },
          ]}
        />
      </Space>

      <Table
        columns={columns}
        dataSource={data?.requests ?? []}
        rowKey="id"
        loading={isLoading}
        pagination={{
          current: page,
          pageSize: 20,
          total: data?.total ?? 0,
          onChange: setPage,
          showTotal: (total) => `${total} requests`,
        }}
        scroll={{ x: 1000 }}
        size="small"
      />
    </div>
  );
}
