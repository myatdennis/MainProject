import React from 'react'
import { Bar } from 'react-chartjs-2'
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js'

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend)

type Props = {
  data?: { label: string; value: number }[]
}

const CompletionChart: React.FC<Props> = ({ data = [] }) => {
  const labels = data.map((d) => d.label)
  const values = data.map((d) => d.value)

  const chartData = {
    labels,
    datasets: [
      {
        label: 'Completion %',
        data: values,
        backgroundColor: 'rgba(58, 123, 255, 0.8)'
      }
    ]
  }

  return <div style={{ maxWidth: 800 }}><Bar data={chartData} /></div>
}

export default CompletionChart
