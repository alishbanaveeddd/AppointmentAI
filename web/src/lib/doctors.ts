/**
 * Directory of available doctors, specialists, and clinical departments.
 */

export interface Doctor {
  id: string;
  name: string;
  specialty: string;
  department: 'Dental' | 'Cardiology' | 'General' | 'Pediatrics';
  avatar: string;
  rating: string;
  availability: string;
  availableDays: string;
  timings: string;
  fee: string;
  serviceName: string;
  badge?: string;
  openSlotsSample: string[];
}

export const AVAILABLE_DOCTORS: Doctor[] = [
  {
    id: 'doc-dental',
    name: 'Dr. Ahmed Malik',
    specialty: 'Lead Dental Surgeon & Orthodontist',
    department: 'Dental',
    avatar: '👨‍⚕️',
    rating: '4.9 ★ (142 reviews)',
    availability: 'Available Today',
    availableDays: 'Monday – Friday',
    timings: '09:00 AM – 05:00 PM PKT',
    fee: '$45 / 30 mins',
    serviceName: 'Dental Checkup with Dr. Ahmed Malik',
    badge: 'Popular',
    openSlotsSample: ['09:30 AM', '11:00 AM', '02:30 PM', '04:00 PM'],
  },
  {
    id: 'doc-cardio',
    name: 'Dr. Sarah Khan',
    specialty: 'Consultant Cardiologist & Heart Specialist',
    department: 'Cardiology',
    avatar: '👩‍⚕️',
    rating: '5.0 ★ (98 reviews)',
    availability: 'Available Mon, Wed, Fri',
    availableDays: 'Mon, Wed, Fri',
    timings: '10:00 AM – 04:30 PM PKT',
    fee: '$60 / 30 mins',
    serviceName: 'Cardiology Consultation with Dr. Sarah Khan',
    badge: 'Top Specialist',
    openSlotsSample: ['10:00 AM', '11:30 AM', '01:30 PM', '03:00 PM'],
  },
  {
    id: 'doc-general',
    name: 'Dr. Ayesha Noor',
    specialty: 'Senior Family Physician & General Medicine',
    department: 'General',
    avatar: '👩‍⚕️',
    rating: '4.8 ★ (210 reviews)',
    availability: 'Available Daily',
    availableDays: 'Monday – Friday',
    timings: '09:00 AM – 05:00 PM PKT',
    fee: '$35 / 30 mins',
    serviceName: 'General Consultation with Dr. Ayesha Noor',
    badge: 'Fast Track',
    openSlotsSample: ['09:00 AM', '10:30 AM', '01:00 PM', '03:30 PM'],
  },
  {
    id: 'doc-pediatric',
    name: 'Dr. Bilal Qureshi',
    specialty: 'Consultant Pediatrician & Child Specialist',
    department: 'Pediatrics',
    avatar: '👨‍⚕️',
    rating: '4.9 ★ (88 reviews)',
    availability: 'Available Tue, Thu',
    availableDays: 'Tue, Thu',
    timings: '09:30 AM – 03:30 PM PKT',
    fee: '$40 / 30 mins',
    serviceName: 'Pediatric Checkup with Dr. Bilal Qureshi',
    badge: 'Children Care',
    openSlotsSample: ['09:30 AM', '11:00 AM', '02:00 PM'],
  },
];
