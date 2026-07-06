import { DonationRecord } from '../types';

export const mockDonationHistory: DonationRecord[] = [
  { id: 'h1',  date: '10 Jan 2024', bloodGroup: 'A+', hospitalName: 'SMS Hospital',      city: 'Jaipur', units: 1, status: 'Completed', patientName: 'Rohit Verma' },
  { id: 'h2',  date: '12 Aug 2023', bloodGroup: 'A+', hospitalName: 'Noble Hospital',    city: 'Jaipur', units: 1, status: 'Completed', patientName: 'Sunita Devi' },
  { id: 'h3',  date: '25 Feb 2023', bloodGroup: 'A+', hospitalName: 'City Hospital',     city: 'Jaipur', units: 1, status: 'Completed', patientName: 'Mahesh Gupta' },
  { id: 'h4',  date: '18 Nov 2022', bloodGroup: 'A+', hospitalName: 'Apollo Hospital',   city: 'Jaipur', units: 1, status: 'Completed', patientName: 'Ratan Singh' },
  { id: 'h5',  date: '05 Aug 2022', bloodGroup: 'A+', hospitalName: 'AIIMS Jaipur',      city: 'Jaipur', units: 1, status: 'Completed', patientName: 'Geeta Sharma' },
  { id: 'h6',  date: '22 May 2022', bloodGroup: 'A+', hospitalName: 'Fortis Hospital',   city: 'Jaipur', units: 1, status: 'Completed', patientName: 'Vijay Kumar' },
  { id: 'h7',  date: '10 Feb 2022', bloodGroup: 'A+', hospitalName: 'Narayana Hospital', city: 'Jaipur', units: 1, status: 'Completed', patientName: 'Anita Patel' },
  { id: 'h8',  date: '28 Oct 2021', bloodGroup: 'A+', hospitalName: 'SMS Hospital',      city: 'Jaipur', units: 1, status: 'Completed', patientName: 'Dinesh Mehta' },
  { id: 'h9',  date: '15 Jul 2021', bloodGroup: 'A+', hospitalName: 'Noble Hospital',    city: 'Jaipur', units: 1, status: 'Cancelled', patientName: 'Sarla Devi' },
  { id: 'h10', date: '02 Apr 2021', bloodGroup: 'A+', hospitalName: 'City Hospital',     city: 'Jaipur', units: 1, status: 'Completed', patientName: 'Kamal Kishore' },
  { id: 'h11', date: '20 Dec 2020', bloodGroup: 'A+', hospitalName: 'Manipal Hospital',  city: 'Jaipur', units: 1, status: 'Completed', patientName: 'Bhavna Joshi' },
  { id: 'h12', date: '08 Sep 2020', bloodGroup: 'A+', hospitalName: 'Apollo Hospital',   city: 'Jaipur', units: 1, status: 'Completed', patientName: 'Govind Rao' },
  { id: 'h13', date: '25 Jun 2020', bloodGroup: 'A+', hospitalName: 'AIIMS Jaipur',      city: 'Jaipur', units: 1, status: 'Cancelled', patientName: 'Lata Sharma' },
  { id: 'h14', date: '12 Mar 2020', bloodGroup: 'A+', hospitalName: 'Fortis Hospital',   city: 'Jaipur', units: 1, status: 'Completed', patientName: 'Suresh Agarwal' },
  { id: 'h15', date: '01 Jan 2020', bloodGroup: 'A+', hospitalName: 'SMS Hospital',      city: 'Jaipur', units: 1, status: 'Completed', patientName: 'Rekha Verma' },
  { id: 'h16', date: '18 Oct 2019', bloodGroup: 'A+', hospitalName: 'Noble Hospital',    city: 'Jaipur', units: 1, status: 'Completed', patientName: 'Harish Chand' },
  { id: 'h17', date: '05 Jul 2019', bloodGroup: 'A+', hospitalName: 'City Hospital',     city: 'Jaipur', units: 1, status: 'Completed', patientName: 'Nirmala Devi' },
  { id: 'h18', date: '22 Apr 2019', bloodGroup: 'A+', hospitalName: 'Manipal Hospital',  city: 'Jaipur', units: 1, status: 'Cancelled', patientName: 'Prakash Singh' },
  { id: 'h19', date: '10 Jan 2019', bloodGroup: 'A+', hospitalName: 'Apollo Hospital',   city: 'Jaipur', units: 1, status: 'Completed', patientName: 'Shobha Kumari' },
  { id: 'h20', date: '28 Sep 2018', bloodGroup: 'A+', hospitalName: 'AIIMS Jaipur',      city: 'Jaipur', units: 1, status: 'Completed', patientName: 'Tilak Raj' },
  { id: 'h21', date: '15 Jun 2018', bloodGroup: 'A+', hospitalName: 'Fortis Hospital',   city: 'Jaipur', units: 1, status: 'Completed', patientName: 'Bimla Sharma' },
  { id: 'h22', date: '01 Mar 2018', bloodGroup: 'A+', hospitalName: 'SMS Hospital',      city: 'Jaipur', units: 1, status: 'Completed', patientName: 'Chandra Bhan' },
  { id: 'h23', date: '18 Dec 2017', bloodGroup: 'A+', hospitalName: 'Noble Hospital',    city: 'Jaipur', units: 1, status: 'Completed', patientName: 'Dhanraj Patel' },
  { id: 'h24', date: '05 Sep 2017', bloodGroup: 'A+', hospitalName: 'Narayana Hospital', city: 'Jaipur', units: 1, status: 'Cancelled', patientName: 'Ekta Verma' },
  { id: 'h25', date: '22 May 2017', bloodGroup: 'A+', hospitalName: 'City Hospital',     city: 'Jaipur', units: 1, status: 'Completed', patientName: 'Fatima Begum' },
  { id: 'h26', date: '10 Feb 2017', bloodGroup: 'A+', hospitalName: 'Apollo Hospital',   city: 'Jaipur', units: 1, status: 'Completed', patientName: 'Gita Rani' },
  { id: 'h27', date: '28 Oct 2016', bloodGroup: 'A+', hospitalName: 'Manipal Hospital',  city: 'Jaipur', units: 1, status: 'Completed', patientName: 'Hemant Kumar' },
  { id: 'h28', date: '14 Jul 2016', bloodGroup: 'A+', hospitalName: 'AIIMS Jaipur',      city: 'Jaipur', units: 1, status: 'Completed', patientName: 'Indra Devi' },
  { id: 'h29', date: '01 Apr 2016', bloodGroup: 'A+', hospitalName: 'Fortis Hospital',   city: 'Jaipur', units: 1, status: 'Cancelled', patientName: 'Jagdish Prasad' },
  { id: 'h30', date: '18 Jan 2016', bloodGroup: 'A+', hospitalName: 'SMS Hospital',      city: 'Jaipur', units: 1, status: 'Completed', patientName: 'Kamini Sharma' },
];

export const getCompletedDonations = () =>
  mockDonationHistory.filter(h => h.status === 'Completed');

export const getCancelledDonations = () =>
  mockDonationHistory.filter(h => h.status === 'Cancelled');
