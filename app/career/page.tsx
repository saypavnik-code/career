import type { Metadata } from 'next'
import CareerDashboard from './CareerDashboard'

export const metadata: Metadata = {
  title: 'Эскада — идеи, работа и карьерный рост',
  description: 'Лёгкая персональная система для развития идей, фиксации wins и подготовки карьерных отчётов.',
}

export default function CareerPage() {
  return <CareerDashboard />
}
