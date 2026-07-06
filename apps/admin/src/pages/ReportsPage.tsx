import React, { useState } from 'react';
import {
  Table, Tag, Button, Space, Typography, Modal,
  Input, Form, message, Tooltip, Switch,
} from 'antd';
import { CheckOutlined } from '@ant-design/icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import dayjs from 'dayjs';
import { adminApi, type AdminReport } from '../api/admin.api';

const { Title } = Typography;
const { TextArea } = Input;

const REASON_LABELS: Record<string, string> = {
  FAKE_PROFILE: 'Fake Profile',
  SPAM: 'Spam',
  HARASSMENT: 'Harassment',
  WRONG_INFO: 'Wrong Info',
  OTHER: 'Other',
};

const REASON_COLORS: Record<string, string> = {
  FAKE_PROFILE: 'red', SPAM: 'orange',
  HARASSMENT: 'volcano', WRONG_INFO: 'gold', OTHER: 'default',
};

const VERIF_COLORS: Record<string, string> = {
  VERIFIED: 'green', PENDING: 'gold', UNVERIFIED: 'default',
  REJECTED: 'red', SUSPENDED: 'volcano',
};

export default function ReportsPage() {
  const qc = useQueryClient();
  const [page, setPage] = useState(1);
  const [showAll, setShowAll] = useState(false);
  const [resolveModal, setResolveModal] = useState<AdminReport | null>(null);
  const [form] = Form.useForm<{ resolution: string }>();

  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'reports', page, showAll],
    queryFn: () => adminApi.getReports(page, !showAll),
    placeholderData: (prev) => prev,
  });

  const resolveMutation = useMutation({
    mutationFn: ({ id, resolution }: { id: string; resolution: string }) =>
      adminApi.resolveReport(id, resolution),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'reports'] });
      qc.invalidateQueries({ queryKey: ['admin', 'stats'] });
      message.success('Report resolved');
      setResolveModal(null);
      form.resetFields();
    },
    onError: () => message.error('Failed to resolve report'),
  });

  const handleResolve = async () => {
    if (!resolveModal) return;
    const values = await form.validateFields();
    resolveMutation.mutate({ id: resolveModal.id, resolution: values.resolution });
  };

  const columns = [
    {
      title: 'Reporter',
      key: 'reporter',
      render: (_: unknown, row: AdminReport) => (
        <div>
          <div style={{ fontWeight: 600 }}>{row.reporter.name}</div>
          <div style={{ color: '#888', fontSize: 12 }}>{row.reporter.phone}</div>
        </div>
      ),
    },
    {
      title: 'Reported User',
      key: 'reported',
      render: (_: unknown, row: AdminReport) => (
        <div>
          <div style={{ fontWeight: 600 }}>{row.reported.name}</div>
          <div style={{ color: '#888', fontSize: 12 }}>{row.reported.phone}</div>
          <Tag color={VERIF_COLORS[row.reported.verifStatus] ?? 'default'} style={{ marginTop: 2 }}>
            {row.reported.verifStatus}
          </Tag>
          {row.reported.reportCount > 1 && (
            <Tag color="red" style={{ marginTop: 2 }}>{row.reported.reportCount} reports</Tag>
          )}
        </div>
      ),
    },
    {
      title: 'Reason',
      dataIndex: 'reason',
      key: 'reason',
      render: (v: string) => (
        <Tag color={REASON_COLORS[v] ?? 'default'}>{REASON_LABELS[v] ?? v}</Tag>
      ),
    },
    {
      title: 'Details',
      dataIndex: 'details',
      key: 'details',
      render: (v: string | null) =>
        v ? (
          <Tooltip title={v}>
            <span style={{ cursor: 'help', color: '#555' }}>
              {v.length > 40 ? v.slice(0, 40) + '…' : v}
            </span>
          </Tooltip>
        ) : '—',
    },
    {
      title: 'Status',
      key: 'status',
      render: (_: unknown, row: AdminReport) =>
        row.resolvedAt ? (
          <Tooltip title={row.resolution ?? ''}>
            <Tag color="green">Resolved {dayjs(row.resolvedAt).format('DD MMM')}</Tag>
          </Tooltip>
        ) : (
          <Tag color="red">Open</Tag>
        ),
    },
    {
      title: 'Filed',
      dataIndex: 'createdAt',
      key: 'createdAt',
      render: (v: string) => dayjs(v).format('DD MMM YYYY'),
    },
    {
      title: 'Action',
      key: 'action',
      render: (_: unknown, row: AdminReport) =>
        !row.resolvedAt ? (
          <Button
            size="small"
            type="primary"
            ghost
            icon={<CheckOutlined />}
            onClick={() => { setResolveModal(row); form.resetFields(); }}
          >
            Resolve
          </Button>
        ) : null,
    },
  ];

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <Title level={4} style={{ margin: 0 }}>Reports</Title>
        <Space>
          <span style={{ color: '#555', fontSize: 13 }}>Show resolved</span>
          <Switch checked={showAll} onChange={v => { setShowAll(v); setPage(1); }} />
        </Space>
      </div>

      <Table
        columns={columns}
        dataSource={data?.reports ?? []}
        rowKey="id"
        loading={isLoading}
        pagination={{
          current: page,
          pageSize: 20,
          total: data?.total ?? 0,
          onChange: setPage,
          showTotal: (total) => `${total} reports`,
        }}
        scroll={{ x: 800 }}
        size="small"
      />

      <Modal
        title={`Resolve report — ${resolveModal?.reported.name}`}
        open={!!resolveModal}
        onOk={handleResolve}
        onCancel={() => setResolveModal(null)}
        confirmLoading={resolveMutation.isPending}
        okText="Resolve"
      >
        <p style={{ color: '#555', marginBottom: 12 }}>
          <strong>Reason:</strong> {resolveModal ? (REASON_LABELS[resolveModal.reason] ?? resolveModal.reason) : ''}
          {resolveModal?.details && <><br /><strong>Details:</strong> {resolveModal.details}</>}
        </p>
        <Form form={form} layout="vertical">
          <Form.Item
            name="resolution"
            label="Resolution note"
            rules={[{ required: true, min: 3, message: 'Enter a resolution note (min 3 chars)' }]}
          >
            <TextArea rows={3} placeholder="e.g. Warned user, content removed, account suspended..." />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
