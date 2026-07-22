import React, { useState } from 'react';
import {
  Table, Tag, Space, Typography, Button, Modal, Form, Input, DatePicker,
  InputNumber, Popconfirm, message,
} from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined } from '@ant-design/icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import dayjs, { Dayjs } from 'dayjs';
import { adminApi, type AdminCamp, type CampInput } from '../api/admin.api';

const { Title } = Typography;
const { TextArea } = Input;

type FormValues = Omit<CampInput, 'startTime' | 'endTime'> & { range: [Dayjs, Dayjs] };

function campLifecycle(camp: AdminCamp): { label: string; color: string } {
  const now = dayjs();
  if (!camp.isActive) return { label: 'Inactive', color: 'default' };
  if (dayjs(camp.startTime).isAfter(now)) return { label: 'Upcoming', color: 'blue' };
  if (dayjs(camp.endTime).isBefore(now)) return { label: 'Past', color: 'default' };
  return { label: 'Ongoing', color: 'green' };
}

export default function CampsPage() {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<AdminCamp | null>(null);
  const [form] = Form.useForm<FormValues>();

  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'camps', page],
    queryFn: () => adminApi.getCamps(page),
    placeholderData: (prev) => prev,
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['admin', 'camps'] });

  const saveMutation = useMutation({
    mutationFn: (body: CampInput) =>
      editing ? adminApi.updateCamp(editing.id, body) : adminApi.createCamp(body),
    onSuccess: () => {
      message.success(editing ? 'Camp updated' : 'Camp created');
      setModalOpen(false);
      setEditing(null);
      form.resetFields();
      invalidate();
    },
    onError: (err: any) => message.error(err?.response?.data?.message ?? 'Save failed'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => adminApi.deleteCamp(id),
    onSuccess: () => { message.success('Camp removed'); invalidate(); },
    onError: (err: any) => message.error(err?.response?.data?.message ?? 'Delete failed'),
  });

  const openCreate = () => {
    setEditing(null);
    form.resetFields();
    setModalOpen(true);
  };

  const openEdit = (camp: AdminCamp) => {
    setEditing(camp);
    form.setFieldsValue({
      name: camp.name,
      tagline: camp.tagline ?? undefined,
      description: camp.description ?? undefined,
      venue: camp.venue,
      address: camp.address ?? undefined,
      city: camp.city ?? undefined,
      lat: camp.lat ?? undefined,
      lng: camp.lng ?? undefined,
      organizer: camp.organizer ?? undefined,
      contactPhone: camp.contactPhone ?? undefined,
      range: [dayjs(camp.startTime), dayjs(camp.endTime)],
    });
    setModalOpen(true);
  };

  const onSubmit = async () => {
    const values = await form.validateFields();
    const { range, ...rest } = values;
    saveMutation.mutate({
      ...rest,
      startTime: range[0].toISOString(),
      endTime: range[1].toISOString(),
    });
  };

  const columns = [
    {
      title: 'Camp',
      dataIndex: 'name',
      key: 'name',
      render: (name: string, row: AdminCamp) => (
        <div>
          <div style={{ fontWeight: 600 }}>{name}</div>
          {row.tagline && <div style={{ color: '#888', fontSize: 12 }}>{row.tagline}</div>}
        </div>
      ),
    },
    {
      title: 'When',
      key: 'when',
      render: (_: unknown, row: AdminCamp) => (
        <div style={{ fontSize: 12 }}>
          <div>{dayjs(row.startTime).format('DD MMM YYYY, HH:mm')}</div>
          <div style={{ color: '#888' }}>to {dayjs(row.endTime).format('DD MMM, HH:mm')}</div>
        </div>
      ),
    },
    {
      title: 'Venue',
      key: 'venue',
      render: (_: unknown, row: AdminCamp) => (
        <div style={{ fontSize: 12 }}>
          <div>{row.venue}</div>
          {row.city && <div style={{ color: '#888' }}>{row.city}</div>}
        </div>
      ),
    },
    {
      title: 'Registered',
      dataIndex: 'attendeeCount',
      key: 'attendeeCount',
      render: (n: number) => <Tag color="red">{n}</Tag>,
    },
    {
      title: 'Status',
      key: 'status',
      render: (_: unknown, row: AdminCamp) => {
        const s = campLifecycle(row);
        return <Tag color={s.color}>{s.label}</Tag>;
      },
    },
    {
      title: 'Actions',
      key: 'actions',
      render: (_: unknown, row: AdminCamp) => (
        <Space>
          <Button size="small" icon={<EditOutlined />} onClick={() => openEdit(row)}>Edit</Button>
          <Popconfirm
            title="Remove this camp?"
            description="It will be hidden from the app."
            onConfirm={() => deleteMutation.mutate(row.id)}
            okText="Remove"
            okButtonProps={{ danger: true }}
          >
            <Button size="small" danger icon={<DeleteOutlined />} />
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <Title level={4} style={{ margin: 0 }}>Blood Camps & Events</Title>
        <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>New Camp</Button>
      </div>

      <Table
        columns={columns}
        dataSource={data?.camps ?? []}
        rowKey="id"
        loading={isLoading}
        pagination={{
          current: page,
          pageSize: 20,
          total: data?.total ?? 0,
          onChange: setPage,
          showTotal: (total) => `${total} camps`,
        }}
        scroll={{ x: 900 }}
        size="small"
      />

      <Modal
        title={editing ? 'Edit Camp' : 'New Camp'}
        open={modalOpen}
        onOk={onSubmit}
        confirmLoading={saveMutation.isPending}
        onCancel={() => { setModalOpen(false); setEditing(null); form.resetFields(); }}
        okText={editing ? 'Save' : 'Create'}
        width={640}
        destroyOnClose
      >
        <Form form={form} layout="vertical" requiredMark="optional">
          <Form.Item name="name" label="Name" rules={[{ required: true, min: 2 }]}>
            <Input placeholder="Blood Donation Camp" />
          </Form.Item>
          <Form.Item name="tagline" label="Tagline">
            <Input placeholder="Helping Today, Saving Tomorrow" />
          </Form.Item>
          <Form.Item name="range" label="Date & time" rules={[{ required: true, message: 'Pick start and end times' }]}>
            <DatePicker.RangePicker showTime format="DD MMM YYYY HH:mm" style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="venue" label="Venue" rules={[{ required: true, min: 2 }]}>
            <Input placeholder="Sunrise Community Hall" />
          </Form.Item>
          <div style={{ display: 'flex', gap: 12 }}>
            <Form.Item name="city" label="City" style={{ flex: 1 }}>
              <Input placeholder="Delhi" />
            </Form.Item>
            <Form.Item name="organizer" label="Organizer" style={{ flex: 1 }}>
              <Input placeholder="Red Cross" />
            </Form.Item>
          </div>
          <Form.Item name="address" label="Address">
            <Input placeholder="Full address (optional)" />
          </Form.Item>
          <div style={{ display: 'flex', gap: 12 }}>
            <Form.Item name="lat" label="Latitude" style={{ flex: 1 }}>
              <InputNumber style={{ width: '100%' }} placeholder="28.6139" />
            </Form.Item>
            <Form.Item name="lng" label="Longitude" style={{ flex: 1 }}>
              <InputNumber style={{ width: '100%' }} placeholder="77.2090" />
            </Form.Item>
            <Form.Item name="contactPhone" label="Contact" style={{ flex: 1 }}>
              <Input placeholder="+91..." />
            </Form.Item>
          </div>
          <Form.Item name="description" label="Description">
            <TextArea rows={3} placeholder="Details about the camp (optional)" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
