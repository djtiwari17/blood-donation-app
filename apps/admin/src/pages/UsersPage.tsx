import React, { useState } from 'react';
import {
  Table, Tag, Space, Button, Input, Select, Popconfirm,
  message, Typography, Tooltip,
} from 'antd';
import { SearchOutlined, CheckCircleOutlined, StopOutlined } from '@ant-design/icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import dayjs from 'dayjs';
import { adminApi, type AdminUser } from '../api/admin.api';

const { Title } = Typography;

const VERIF_COLORS: Record<string, string> = {
  VERIFIED: 'green', PENDING: 'gold', UNVERIFIED: 'default',
  REJECTED: 'red', SUSPENDED: 'volcano',
};

const ROLE_COLORS: Record<string, string> = {
  DONOR: 'blue', RECEIVER: 'purple', DONOR_RECEIVER: 'cyan',
  ADMIN: 'red', SUPER_ADMIN: 'magenta',
};

export default function UsersPage() {
  const qc = useQueryClient();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('');

  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'users', page, search, roleFilter, statusFilter],
    queryFn: () => adminApi.getUsers(page, search || undefined, roleFilter || undefined, statusFilter || undefined),
    placeholderData: (prev) => prev,
  });

  const updateMutation = useMutation({
    mutationFn: ({ userId, body }: { userId: string; body: { verifStatus?: string; isBlocked?: boolean } }) =>
      adminApi.updateUserStatus(userId, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'users'] });
      message.success('User updated');
    },
    onError: () => message.error('Update failed'),
  });

  const columns = [
    {
      title: 'Name',
      dataIndex: 'name',
      key: 'name',
      render: (name: string, row: AdminUser) => (
        <div>
          <div style={{ fontWeight: 600 }}>{name}</div>
          <div style={{ color: '#888', fontSize: 12 }}>{row.phone}</div>
        </div>
      ),
    },
    { title: 'City', dataIndex: 'city', key: 'city', render: (v: string | null) => v ?? '—' },
    {
      title: 'Blood',
      dataIndex: 'bloodGroup',
      key: 'bloodGroup',
      render: (v: string) => <Tag color="red">{v}</Tag>,
    },
    {
      title: 'Role',
      dataIndex: 'role',
      key: 'role',
      render: (v: string) => <Tag color={ROLE_COLORS[v] ?? 'default'}>{v}</Tag>,
    },
    {
      title: 'Status',
      dataIndex: 'verifStatus',
      key: 'verifStatus',
      render: (v: string) => <Tag color={VERIF_COLORS[v] ?? 'default'}>{v}</Tag>,
    },
    {
      title: 'Reports',
      dataIndex: 'reportCount',
      key: 'reportCount',
      render: (n: number) => n > 0 ? <Tag color={n >= 3 ? 'red' : 'orange'}>{n}</Tag> : 0,
    },
    {
      title: 'Blocked',
      dataIndex: 'isBlocked',
      key: 'isBlocked',
      render: (v: boolean) => v ? <Tag color="red">Yes</Tag> : <Tag color="green">No</Tag>,
    },
    {
      title: 'Joined',
      dataIndex: 'createdAt',
      key: 'createdAt',
      render: (v: string) => dayjs(v).format('DD MMM YYYY'),
    },
    {
      title: 'Actions',
      key: 'actions',
      render: (_: unknown, row: AdminUser) => (
        <Space size="small" wrap>
          {row.verifStatus !== 'VERIFIED' && (
            <Tooltip title="Verify user">
              <Button
                size="small"
                type="primary"
                ghost
                icon={<CheckCircleOutlined />}
                loading={updateMutation.isPending}
                onClick={() => updateMutation.mutate({ userId: row.id, body: { verifStatus: 'VERIFIED' } })}
              >
                Verify
              </Button>
            </Tooltip>
          )}
          {row.verifStatus !== 'REJECTED' && row.verifStatus !== 'SUSPENDED' && (
            <Popconfirm
              title="Reject this user?"
              onConfirm={() => updateMutation.mutate({ userId: row.id, body: { verifStatus: 'REJECTED' } })}
              okText="Reject"
              okButtonProps={{ danger: true }}
            >
              <Button size="small" danger ghost>Reject</Button>
            </Popconfirm>
          )}
          {row.verifStatus !== 'SUSPENDED' && (
            <Popconfirm
              title="Suspend this user?"
              onConfirm={() => updateMutation.mutate({ userId: row.id, body: { verifStatus: 'SUSPENDED', isBlocked: true } })}
              okText="Suspend"
              okButtonProps={{ danger: true }}
            >
              <Button size="small" danger icon={<StopOutlined />}>Suspend</Button>
            </Popconfirm>
          )}
          {row.verifStatus === 'SUSPENDED' && (
            <Button
              size="small"
              onClick={() => updateMutation.mutate({ userId: row.id, body: { verifStatus: 'UNVERIFIED', isBlocked: false } })}
            >
              Reinstate
            </Button>
          )}
        </Space>
      ),
    },
  ];

  return (
    <div>
      <Title level={4} style={{ marginBottom: 16 }}>Users</Title>

      <Space style={{ marginBottom: 16 }} wrap>
        <Input
          placeholder="Search name or phone"
          prefix={<SearchOutlined />}
          value={search}
          onChange={e => { setSearch(e.target.value); setPage(1); }}
          style={{ width: 240 }}
          allowClear
        />
        <Select
          placeholder="Filter by role"
          style={{ width: 160 }}
          allowClear
          value={roleFilter || undefined}
          onChange={v => { setRoleFilter(v ?? ''); setPage(1); }}
          options={[
            { value: 'DONOR',          label: 'Donor' },
            { value: 'RECEIVER',       label: 'Receiver' },
            { value: 'DONOR_RECEIVER', label: 'Donor & Receiver' },
            { value: 'ADMIN',          label: 'Admin' },
          ]}
        />
        <Select
          placeholder="Filter by status"
          style={{ width: 160 }}
          allowClear
          value={statusFilter || undefined}
          onChange={v => { setStatusFilter(v ?? ''); setPage(1); }}
          options={[
            { value: 'UNVERIFIED', label: 'Unverified' },
            { value: 'PENDING',    label: 'Pending' },
            { value: 'VERIFIED',   label: 'Verified' },
            { value: 'REJECTED',   label: 'Rejected' },
            { value: 'SUSPENDED',  label: 'Suspended' },
          ]}
        />
      </Space>

      <Table
        columns={columns}
        dataSource={data?.users ?? []}
        rowKey="id"
        loading={isLoading}
        pagination={{
          current: page,
          pageSize: 20,
          total: data?.total ?? 0,
          onChange: setPage,
          showTotal: (total) => `${total} users`,
        }}
        scroll={{ x: 900 }}
        size="small"
      />
    </div>
  );
}
