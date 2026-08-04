import type { Metadata } from 'next'
import CareerDashboard from './CareerDashboard'

export const metadata: Metadata = {
  title: 'Career OS — Ideas, Wins, Reports',
  description: 'Лёгкая персональная система для фиксации идей, достижений и карьерных отчётов.',
}

export default function CareerPage() {
  return <CareerDashboard />
}
