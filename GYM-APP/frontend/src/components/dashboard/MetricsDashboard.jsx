import React, { useEffect, useState } from 'react';
import axios from 'axios';
import authService from '../../services/authService';
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';

const GYM_APP_API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

// Paletas de colores para los gráficos
const PIE_COLORS = ['#0088FE', '#cb00dd', '#00da41', '#FF8042', '#8884d8', '#c703a6'];
const BAR_COLORS = ['#0b00d4', '#007022', '#ffaa00', '#ff5500', '#0088FE', '#00C49F', '#FFBB28', '#d0ed57', '#ff7300'];


const MetricsDashboard = () => {
    const [metricsData, setMetricsData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    useEffect(() => {
        const fetchMetrics = async () => {
            try {
                setLoading(true);
                const response = await axios.get(`${GYM_APP_API_BASE_URL}/users/metrics`, { headers: authService.getAuthHeaders() });
                setMetricsData(response.data);
                setError('');
            } catch (err) {
                setError('No se pudieron cargar las métricas. Revisa la consola para más detalles.');
                console.error(err);
            } finally {
                setLoading(false);
            }
        };
        fetchMetrics();
    }, []);

    if (loading) return <div>Cargando métricas...</div>;
    if (error) return <div className="notification notification-error">{error}</div>;
    if (!metricsData) return <div>No hay datos de métricas para mostrar.</div>;

    return (
        <div className="dashboard-section">
            <div className="metrics-grid">
                
                <div className="metric-card">
                    <h4>Distribución por Sexo</h4>
                    <ResponsiveContainer width="100%" height={250}>
                        <PieChart>
                            <Pie data={metricsData.genderDistribution} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label>
                                {metricsData.genderDistribution.map((entry, index) => (
                                    <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                                ))}
                            </Pie>
                            <Tooltip />
                            <Legend />
                        </PieChart>
                    </ResponsiveContainer>
                </div>

                <div className="metric-card">
                    <h4>Distribución por Edad</h4>
                    <ResponsiveContainer width="100%" height={250}>
                        <BarChart data={metricsData.ageDistribution}>
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis dataKey="name" />
                            <YAxis allowDecimals={false} />
                            <Tooltip />
                            <Legend />
                            <Bar dataKey="value" name="Socios">
                                {metricsData.ageDistribution.map((entry, index) => (
                                    <Cell key={`cell-${index}`} fill={BAR_COLORS[index % BAR_COLORS.length]} />
                                ))}
                            </Bar>
                        </BarChart>
                    </ResponsiveContainer>
                </div>

                <div className="metric-card full-width">
                    <h4>Tasa de Ocupación por Tipo de Clase (%)</h4>
                    <ResponsiveContainer width="100%" height={300}>
                        <BarChart data={metricsData.occupancyRate} layout="vertical" margin={{ top: 20, right: 30, left: 40, bottom: 5 }}>
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis type="number" domain={[0, 100]} tickFormatter={(tick) => `${tick}%`} />
                            <YAxis type="category" dataKey="name" width={120} />
                            <Tooltip formatter={(value) => `${value.toFixed(2)}%`} />
                            <Legend />
                            <Bar dataKey="ocupacion" name="Ocupación">
                                {metricsData.occupancyRate.map((entry, index) => (
                                    <Cell key={`cell-${index}`} fill={BAR_COLORS[index % BAR_COLORS.length]} />
                                ))}
                            </Bar>
                        </BarChart>
                    </ResponsiveContainer>
                </div>

                <div className="metric-card full-width">
                    <h4>Horarios de Mayor Demanda (Total Inscriptos)</h4>
                    <ResponsiveContainer width="100%" height={300}>
                        <BarChart data={metricsData.peakHours}>
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis dataKey="name" />
                            <YAxis allowDecimals={false} />
                            <Tooltip />
                            <Legend />
                            <Bar dataKey="value" name="Total Inscriptos">
                                {metricsData.peakHours.map((entry, index) => (
                                    <Cell key={`cell-${index}`} fill={BAR_COLORS[index % BAR_COLORS.length]} />
                                ))}
                            </Bar>
                        </BarChart>
                    </ResponsiveContainer>
                </div>

                <div className="metric-card full-width">
                    <h4>Créditos Totales por Tipo de Clase</h4>
                    <ResponsiveContainer width="100%" height={300}>
                        <BarChart data={metricsData.creditsPerClassType} layout="vertical" margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis type="number" allowDecimals={false}/>
                            <YAxis type="category" dataKey="name" width={100} />
                            <Tooltip />
                            <Legend />
                            <Bar dataKey="value" name="Total de Créditos">
                                {metricsData.creditsPerClassType.map((entry, index) => (
                                    <Cell key={`cell-${index}`} fill={BAR_COLORS[index % BAR_COLORS.length]} />
                                ))}
                            </Bar>
                        </BarChart>
                    </ResponsiveContainer>
                </div>

                <div className="metric-card full-width">
                    <h4>Nuevos Socios por Mes</h4>
                    <ResponsiveContainer width="100%" height={300}>
                        <LineChart data={metricsData.newClientsPerMonth}>
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis dataKey="name" />
                            <YAxis allowDecimals={false} />
                            <Tooltip />
                            <Legend />
                            <Line type="monotone" dataKey="value" stroke="#000000" name="Nuevos Socios" activeDot={{ r: 8 }} />
                        </LineChart>
                    </ResponsiveContainer>
                </div>
                
            </div>
        </div>
    );
};

export default MetricsDashboard;
