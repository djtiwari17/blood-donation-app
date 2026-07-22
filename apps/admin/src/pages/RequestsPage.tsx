import React, { useState } from 'react';
import {
  Table, Tag, Select, Space, Typography, Button, Drawer, Modal, Input,
  Descriptions, Statistic, Row, Col, message, Tooltip,
} from 'antd';
import {
  CheckOutlined, CloseOutlined, SafetyCertificateOutlined, WarningOutlined, EyeOutlined,
} from '@ant-design/icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import dayjs from 'dayjs';
import { adminApi, type AdminRequest, type ModerationAction } from '../api/admin.api';

const { Title, Text } = Typography;

const STATUS_COLORS: Record<string, string> = {
  PENDING: 'blue', PARTIALLY_FULFILLED: 'gold',
  FULFILLED: 'green', EXPIRED: 'default', CANCELLED: 'red',
};

const URGENCY_COLORS: Record<string, string> = {
  CRITICAL: 'red', HIGH: 'orange', MEDIUM: 'gold', LOW: 'default',
};

const MOD_COLORS: Record<string, string> = {
  PENDING_REVIEW: 'gold', APPROVED: 'green', REJECTED: 'red',
};

export default function RequestsPage() {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [modFilter, setModFilter] = useState<string>('PENDING_REVIEW');
  const [detailId, setDetailId] = useState<string | null>(null);
  const [reasonModal, setReasonModal] = useState<{ id: string; action: ModerationAction } | null>(null);
  const [reason, setReason] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'requests', page, statusFilter, modFilter],
    queryFn: () => adminApi.getRequests(page, statusFilter || undefined, modFilter || undefined),
    placeholderData: (prev) => prev,
  });

  const detailQuery = useQuery({
    queryKey: ['admin', 'request', detailId],
    queryFn: () => adminApi.getRequestDetail(detailId as string),
    enabled: !!detailId,
  });

  const moderate = useMutation({
    mutationFn: ({ id, action, reason }: { id: string; action: ModerationAction; reason?: string }) =>
      adminApi.moderateRequest(id, action, reason),
    onSuccess: (res) => {
      message.success(
        res.flaggedUser ? 'Done — requester auto-flagged for repeat fakes' : 'Request updated',
      );
      queryClient.invalidateQueries({ queryKey: ['admin', 'requests'] });
      queryClient.invalidateQueries({ queryKey: ['admin', 'request'] });
      setReasonModal(null);
      setReason('');
    },
    onError: (err: any) => message.error(err?.response?.data?.message ?? 'Action failed'),
  });

  const act = (id: string, action: ModerationAction) => {
    if (action === 'REJECT' || action === 'MARK_FAKE') {
      setReasonModal({ id, action });
      setReason('');
    } else {
      moderate.mutate({ id, action });
    }
  };

  const columns = [
    {
      title: 'Patient / Requester',
      key: 'patient',
      render: (_: unknown, row: AdminRequest) => (
        <div>
          <Space size={4}>
            <span style={{ fontWeight: 600 }}>{row.patientName}</span>
            {row.isVerified && <Tooltip title="Verified"><SafetyCertificateOutlined style={{ color: '#27ae60' }} /></Tooltip>}
            {row.isFake && <Tag color="red">FAKE</Tag>}
            {row.suspicious && !row.isFake && <Tooltip title="Requester flagged or has strikes"><WarningOutlined style={{ color: '#e67e22' }} /></Tooltip>}
          </Space>
          <div style={{ color: '#888', fontSize: 12 }}>{row.hospitalName}</div>
          <div style={{ color: '#aaa', fontSize: 12 }}>
            {row.receiver.name} · {row.receiver.phone}
            {row.receiver.strikeCount > 0 && <Tag color="volcano" style={{ marginLeft: 6 }}>{row.receiver.strikeCount} strikes</Tag>}
          </div>
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
      title: 'Moderation',
      dataIndex: 'moderationStatus',
      key: 'moderationStatus',
      render: (v: string) => <Tag color={MOD_COLORS[v] ?? 'default'}>{v.replace('_', ' ')}</Tag>,
    },
    {
      title: 'Fulfillment',
      dataIndex: 'status',
      key: 'status',
      render: (v: string) => <Tag color={STATUS_COLORS[v] ?? 'default'}>{v.replace('_', ' ')}</Tag>,
    },
    {
      title: 'Created',
      dataIndex: 'createdAt',
      key: 'createdAt',
      render: (v: string) => dayjs(v).format('DD MMM, HH:mm'),
    },
    {
      title: 'Actions',
      key: 'actions',
      width: 260,
      render: (_: unknown, row: AdminRequest) => (
        <Space wrap size={4}>
          <Button size="small" icon={<EyeOutlined />} onClick={() => setDetailId(row.id)} />
          {row.moderationStatus !== 'APPROVED' && (
            <Button size="small" type="primary" icon={<CheckOutlined />} onClick={() => act(row.id, 'APPROVE')}>Approve</Button>
          )}
          {!row.isVerified && (
            <Button size="small" icon={<SafetyCertificateOutlined />} onClick={() => act(row.id, 'VERIFY')} style={{ color: '#27ae60', borderColor: '#27ae60' }}>Verify</Button>
          )}
          {row.moderationStatus !== 'REJECTED' && (
            <Button size="small" danger icon={<CloseOutlined />} onClick={() => act(row.id, 'REJECT')}>Reject</Button>
          )}
          {!row.isFake && (
            <Button size="small" danger icon={<WarningOutlined />} onClick={() => act(row.id, 'MARK_FAKE')}>Fake</Button>
          )}
        </Space>
      ),
    },
  ];

  const d = detailQuery.data;

  return (
    <div>
      <Title level={4} style={{ marginBottom: 16 }}>Blood Requests</Title>

      <Space style={{ marginBottom: 16 }} wrap>
        <Select
          placeholder="Moderation"
          style={{ width: 180 }}
          allowClear
          value={modFilter || undefined}
          onChange={v => { setModFilter(v ?? ''); setPage(1); }}
          options={[
            { value: 'PENDING_REVIEW', label: 'Pending Review' },
            { value: 'APPROVED', label: 'Approved' },
            { value: 'REJECTED', label: 'Rejected' },
          ]}
        />
        <Select
          placeholder="Fulfillment status"
          style={{ width: 200 }}
          allowClear
          value={statusFilter || undefined}
          onChange={v => { setStatusFilter(v ?? ''); setPage(1); }}
          options={[
            { value: 'PENDING', label: 'Pending' },
            { value: 'PARTIALLY_FULFILLED', label: 'Partially Fulfilled' },
            { value: 'FULFILLED', label: 'Fulfilled' },
            { value: 'EXPIRED', label: 'Expired' },
            { value: 'CANCELLED', label: 'Cancelled' },
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
        scroll={{ x: 1100 }}
        size="small"
      />

      {/* Reason modal for reject / mark-fake */}
      <Modal
        title={reasonModal?.action === 'MARK_FAKE' ? 'Mark as Fake / Spam' : 'Reject Request'}
        open={!!reasonModal}
        onOk={() => reasonModal && moderate.mutate({ id: reasonModal.id, action: reasonModal.action, reason: reason || undefined })}
        confirmLoading={moderate.isPending}
        onCancel={() => setReasonModal(null)}
        okText={reasonModal?.action === 'MARK_FAKE' ? 'Mark Fake' : 'Reject'}
        okButtonProps={{ danger: true }}
      >
        <Text type="secondary">
          {reasonModal?.action === 'MARK_FAKE'
            ? 'This auto-rejects the request and adds a strike to the requester.'
            : 'This request will be hidden from donors.'}
        </Text>
        <Input.TextArea
          rows={3}
          style={{ marginTop: 12 }}
          placeholder="Reason (optional — shown to the requester)"
          value={reason}
          onChange={e => setReason(e.target.value)}
        />
      </Modal>

      {/* Detail drawer with requester trust history */}
      <Drawer
        title="Request Details"
        width={520}
        open={!!detailId}
        onClose={() => setDetailId(null)}
        loading={detailQuery.isLoading}
      >
        {d && (
          <>
            <Descriptions column={1} size="small" bordered>
              <Descriptions.Item label="Code">{d.requestCode}</Descriptions.Item>
              <Descriptions.Item label="Patient">{d.patientName}</Descriptions.Item>
              <Descriptions.Item label="Hospital">{d.hospitalName}</Descriptions.Item>
              <Descriptions.Item label="Blood / Units">{d.bloodGroup} · {d.unitsNeeded}</Descriptions.Item>
              <Descriptions.Item label="Moderation">
                <Tag color={MOD_COLORS[d.moderationStatus]}>{d.moderationStatus.replace('_', ' ')}</Tag>
                {d.isVerified && <Tag color="green">Verified</Tag>}
                {d.isFake && <Tag color="red">Fake</Tag>}
              </Descriptions.Item>
              {d.rejectionReason && <Descriptions.Item label="Reason">{d.rejectionReason}</Descriptions.Item>}
              <Descriptions.Item label="Requester">{d.receiver.name} · {d.receiver.phone}</Descriptions.Item>
            </Descriptions>

            <Title level={5} style={{ marginTop: 20 }}>Requester History</Title>
            <Row gutter={12}>
              <Col span={8}><Statistic title="Total requests" value={d.requesterHistory.totalRequests} /></Col>
              <Col span={8}><Statistic title="Fulfilled" value={d.requesterHistory.fulfilledRequests} /></Col>
              <Col span={8}><Statistic title="Rejected" value={d.requesterHistory.rejectedRequests} /></Col>
            </Row>
            <Row gutter={12} style={{ marginTop: 12 }}>
              <Col span={8}><Statistic title="Fake" value={d.requesterHistory.fakeRequests} valueStyle={{ color: d.requesterHistory.fakeRequests ? '#c0392b' : undefined }} /></Col>
              <Col span={8}><Statistic title="Strikes" value={d.requesterHistory.strikeCount} valueStyle={{ color: d.requesterHistory.strikeCount ? '#c0392b' : undefined }} /></Col>
              <Col span={8}><Statistic title={`Last ${d.requesterHistory.recentWindowHours}h`} value={d.requesterHistory.recentRequests} /></Col>
            </Row>
            {d.requesterHistory.isFlagged && (
              <Tag color="red" style={{ marginTop: 16 }}>⚠ Requester auto-flagged for repeated fake requests</Tag>
            )}

            <Space style={{ marginTop: 24 }} wrap>
              {d.moderationStatus !== 'APPROVED' && (
                <Button type="primary" icon={<CheckOutlined />} onClick={() => moderate.mutate({ id: d.id, action: 'APPROVE' })}>Approve</Button>
              )}
              {!d.isVerified && (
                <Button icon={<SafetyCertificateOutlined />} onClick={() => moderate.mutate({ id: d.id, action: 'VERIFY' })}>Verify</Button>
              )}
              {d.moderationStatus !== 'REJECTED' && (
                <Button danger icon={<CloseOutlined />} onClick={() => act(d.id, 'REJECT')}>Reject</Button>
              )}
              {!d.isFake && (
                <Button danger icon={<WarningOutlined />} onClick={() => act(d.id, 'MARK_FAKE')}>Mark Fake</Button>
              )}
            </Space>
          </>
        )}
      </Drawer>
    </div>
  );
}
