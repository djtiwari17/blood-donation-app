import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView,
  KeyboardAvoidingView, Platform, TouchableOpacity, Alert,
} from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import { ReceiverHomeStackParamList } from '../../navigation/types';
import { colors, fonts, spacing, radius } from '../../theme';
import { Header } from '../../components/Header';
import { Input } from '../../components/Input';
import { Button } from '../../components/Button';
import { SelectPicker } from '../../components/SelectPicker';
import { SearchPicker } from '../../components/SearchPicker';
import { BLOOD_GROUPS } from '../../utils/helpers';
import { requestsApi, CreateRequestPayload } from '../../api/requests.api';
import { geocodingApi } from '../../api/geocoding.api';

async function getDeviceLocation(): Promise<{ lat: number; lng: number } | null> {
  try {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') return null;
    const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
    return { lat: loc.coords.latitude, lng: loc.coords.longitude };
  } catch {
    return null;
  }
}

type Props = { navigation: NativeStackNavigationProp<ReceiverHomeStackParamList, 'CreateRequest'> };

const UNITS = ['1', '2', '3', '4', '5', '6'];
const URGENCY_OPTIONS = [
  { label: 'Critical', value: 'CRITICAL' },
  { label: 'High',     value: 'HIGH' },
  { label: 'Medium',   value: 'MEDIUM' },
  { label: 'Low',      value: 'LOW' },
];

export const CreateRequestScreen: React.FC<Props> = ({ navigation }) => {
  const [patientName, setPatientName] = useState('');
  const [hospitalName, setHospitalName] = useState('');
  const [hospitalCoords, setHospitalCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [bloodGroup, setBloodGroup] = useState('');
  const [units, setUnits] = useState('');
  const [urgency, setUrgency] = useState('');
  const [requiredBy, setRequiredBy] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [deviceLocation, setDeviceLocation] = useState<{ lat: number; lng: number } | null>(null);

  useEffect(() => {
    getDeviceLocation().then(setDeviceLocation);
  }, []);

  const validate = () => {
    const e: Record<string, string> = {};
    if (!patientName.trim()) e.patientName = 'Enter patient name';
    if (!hospitalName.trim()) e.hospitalName = 'Enter hospital name';
    if (!bloodGroup) e.bloodGroup = 'Select blood group';
    if (!units) e.units = 'Select units needed';
    if (!urgency) e.urgency = 'Select urgency level';
    if (!requiredBy.trim()) e.requiredBy = 'Enter required by date (DD/MM/YYYY HH:MM)';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const parseRequiredBy = (raw: string): string | null => {
    // Accept "DD/MM/YYYY HH:MM" or ISO string
    const dmyMatch = raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})\s+(\d{1,2}):(\d{2})$/);
    if (dmyMatch) {
      const [, dd, mm, yyyy, hh, min] = dmyMatch;
      return new Date(`${yyyy}-${mm.padStart(2,'0')}-${dd.padStart(2,'0')}T${hh.padStart(2,'0')}:${min}:00`).toISOString();
    }
    const d = new Date(raw);
    return isNaN(d.getTime()) ? null : d.toISOString();
  };

  const handleSubmit = async () => {
    if (!validate()) return;

    const isoDate = parseRequiredBy(requiredBy);
    if (!isoDate) {
      setErrors(e => ({ ...e, requiredBy: 'Invalid date. Use DD/MM/YYYY HH:MM' }));
      return;
    }

    setLoading(true);
    try {
      const payload: CreateRequestPayload = {
        patientName: patientName.trim(),
        hospitalName: hospitalName.trim(),
        bloodGroup,
        unitsNeeded: parseInt(units, 10),
        urgency: urgency as CreateRequestPayload['urgency'],
        requiredBy: isoDate,
        ...(hospitalCoords ? { hospitalLat: hospitalCoords.lat, hospitalLng: hospitalCoords.lng } : {}),
      };
      const request = await requestsApi.createRequest(payload);
      navigation.navigate('RequestSubmitted', { requestId: request.id });
    } catch (err: any) {
      const msg = err?.response?.data?.message ?? 'Failed to submit request. Please try again.';
      Alert.alert('Error', Array.isArray(msg) ? msg.join('\n') : msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={styles.container}>
        <Header title="Create Blood Request" onBack={() => navigation.goBack()} />
        <ScrollView contentContainerStyle={styles.form} keyboardShouldPersistTaps="handled">
          <Text style={styles.subheader}>Fill in the details below</Text>

          <Input
            label="Patient Name"
            value={patientName}
            onChangeText={t => { setPatientName(t); setErrors(e => ({ ...e, patientName: '' })); }}
            placeholder="Full name of patient"
            autoCapitalize="words"
            error={errors.patientName}
          />

          <SearchPicker
            label="Hospital Name"
            value={hospitalName}
            placeholder="Type to search hospital name"
            search={q => geocodingApi.searchHospitals(q, deviceLocation?.lat, deviceLocation?.lng)}
            onSelect={result => {
              setHospitalName(result.shortName);
              setHospitalCoords({ lat: result.lat, lng: result.lng });
              setErrors(e => ({ ...e, hospitalName: '' }));
            }}
            error={errors.hospitalName}
          />

          <SelectPicker
            label="Blood Group"
            value={bloodGroup}
            options={BLOOD_GROUPS}
            placeholder="Select blood group"
            onSelect={v => { setBloodGroup(v); setErrors(e => ({ ...e, bloodGroup: '' })); }}
            error={errors.bloodGroup}
          />

          <SelectPicker
            label="Units Needed"
            value={units}
            options={UNITS}
            placeholder="Select units"
            onSelect={v => { setUnits(v); setErrors(e => ({ ...e, units: '' })); }}
            error={errors.units}
          />

          <Text style={styles.urgencyLabel}>Urgency Level</Text>
          <View style={styles.urgencyRow}>
            {URGENCY_OPTIONS.map(u => (
              <TouchableOpacity
                key={u.value}
                style={[styles.urgencyChip, urgency === u.value && styles.urgencyActive]}
                onPress={() => { setUrgency(u.value); setErrors(e => ({ ...e, urgency: '' })); }}
              >
                <Text style={[styles.urgencyText, urgency === u.value && styles.urgencyTextActive]}>
                  {u.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
          {errors.urgency ? <Text style={styles.errorText}>{errors.urgency}</Text> : null}

          <Input
            label="Required By"
            value={requiredBy}
            onChangeText={t => { setRequiredBy(t); setErrors(e => ({ ...e, requiredBy: '' })); }}
            placeholder="DD/MM/YYYY HH:MM  e.g. 13/06/2026 18:00"
            rightIcon="calendar-outline"
            error={errors.requiredBy}
          />

          <View style={styles.notice}>
            <Ionicons name="information-circle" size={18} color={colors.secondary} />
            <Text style={styles.noticeText}>
              Compatible donors near the hospital will be notified immediately.
            </Text>
          </View>

          <Button label="Submit Request" onPress={handleSubmit} loading={loading} style={styles.btn} />
          <View style={{ height: 32 }} />
        </ScrollView>
      </View>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.white },
  form: { padding: spacing.base },
  subheader: { fontSize: fonts.sizes.sm, color: colors.textSecondary, marginBottom: spacing.base },
  urgencyLabel: {
    fontSize: fonts.sizes.sm, color: colors.textSecondary,
    fontWeight: '500', marginBottom: spacing.xs,
  },
  urgencyRow: { flexDirection: 'row', gap: spacing.sm, flexWrap: 'wrap', marginBottom: spacing.md },
  urgencyChip: {
    paddingHorizontal: spacing.md, paddingVertical: 8,
    borderRadius: radius.full, borderWidth: 1.5, borderColor: colors.border,
    backgroundColor: colors.white,
  },
  urgencyActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  urgencyText: { fontSize: fonts.sizes.sm, color: colors.textSecondary, fontWeight: '600' },
  urgencyTextActive: { color: colors.white },
  errorText: { fontSize: fonts.sizes.xs, color: colors.error, marginTop: -spacing.sm, marginBottom: spacing.sm },
  notice: {
    flexDirection: 'row', gap: spacing.xs, backgroundColor: '#E3F2FD',
    padding: spacing.md, borderRadius: radius.md, alignItems: 'flex-start', marginBottom: spacing.md,
  },
  noticeText: { flex: 1, fontSize: fonts.sizes.sm, color: colors.secondary, lineHeight: 20 },
  btn: { marginTop: spacing.xs },
});
