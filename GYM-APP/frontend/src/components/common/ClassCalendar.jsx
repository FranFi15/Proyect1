import React, { useState, useEffect, useMemo } from 'react';
import '../../styles/Calendar.css';

// --- FUNCIONES AUXILIARES ---

const getDayName = (dayIndex) => {
    const days = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
    return days[dayIndex];
};

const getOccupancyClass = (inscritos, capacidad) => {
    if (capacidad === 0) return 'occupancy-empty';
    const percentage = (inscritos / capacidad) * 100;
    if (percentage >= 90) return 'occupancy-high';
    if (percentage >= 50) return 'occupancy-medium';
    return 'occupancy-low';
};

// --- COMPONENTE PRINCIPAL ---

function ClassCalendar({ classes, onEditClass, onCancelClass, onDeleteClass, onReactivateClass, classTypes,onViewRoster  }) {
    const [currentDate, setCurrentDate] = useState(new Date()); 
    const [selectedDayClasses, setSelectedDayClasses] = useState([]); 
    const [selectedDate, setSelectedDate] = useState(null); 
    const [listTypeFilter, setListTypeFilter] = useState('all');

    const getMonthName = (date) => date.toLocaleString('es-ES', { month: 'long', year: 'numeric' });

    const classesByDay = useMemo(() => {
    const map = new Map();
    (classes || []).forEach(clase => {
        if (clase.fecha) {
            const dateKey = clase.fecha.substring(0, 10);

            if (!map.has(dateKey)) {
                map.set(dateKey, []);
            }
            map.get(dateKey).push(clase);
        }
    });
    return map;
}, [classes]);
    useEffect(() => {
        if (selectedDate) {
            const dateKey = selectedDate.toISOString().substring(0, 10);
            setSelectedDayClasses(classesByDay.get(dateKey) || []);
        } else {
            setSelectedDayClasses([]);
        }
    }, [selectedDate, classesByDay]); 

    const daysInMonth = useMemo(() => {
        const year = currentDate.getFullYear();
        const month = currentDate.getMonth();
        const days = [];
        const firstDayOfMonth = new Date(year, month, 1);
        const lastDateOfMonth = new Date(year, month + 1, 0);
        const startDayIndex = firstDayOfMonth.getDay() === 0 ? 6 : firstDayOfMonth.getDay() - 1;
        const prevMonthLastDate = new Date(year, month, 0).getDate();

        for (let i = startDayIndex; i > 0; i--) {
            days.push({ date: new Date(year, month - 1, prevMonthLastDate - i + 1), isCurrentMonth: false });
        }
        for (let i = 1; i <= lastDateOfMonth.getDate(); i++) {
            days.push({ date: new Date(year, month, i), isCurrentMonth: true });
        }
        let nextMonthDay = 1;
        while (days.length % 7 !== 0) {
            days.push({ date: new Date(year, month + 1, nextMonthDay++), isCurrentMonth: false });
        }
        return days;
    }, [currentDate]);

    const filteredClassesForList = useMemo(() => {
        return listTypeFilter === 'all'
            ? selectedDayClasses
            : selectedDayClasses.filter(clase => clase.tipoClase?._id === listTypeFilter);
    }, [selectedDayClasses, listTypeFilter]);

    const handleDayClick = (dayDate) => {
        setSelectedDate(dayDate);
        setListTypeFilter('all');
    };
    const goToPreviousMonth = () => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
    const goToNextMonth = () => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));

    return (
        <div className="calendar-container">
            <div className="calendar-navigation">
                <button onClick={goToPreviousMonth} className="calendar-btn">&lt; Mes Anterior</button>
                <h4 className="calendar-month-year">{getMonthName(currentDate)}</h4>
                <button onClick={goToNextMonth} className="calendar-btn">Mes Siguiente &gt;</button>
            </div>
            <div className="calendar-weekdays">
                {['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'].map(day => <span key={day}>{day}</span>)}
            </div>
            <div className="calendar-grid">
                {daysInMonth.map((day, index) => {
                    const dateKey = day.date.toISOString().substring(0, 10);
                    const classesOnThisDay = classesByDay.get(dateKey) || [];
                    const activeClasses = classesOnThisDay.filter(c => c.estado !== 'cancelada');
                    const hasClasses = classesOnThisDay.length > 0;
                    const allCanceled = hasClasses && activeClasses.length === 0;
                    let dayClass = '';

                    if (allCanceled) {
                        dayClass = 'calendar-day-canceled';
                    } else if (activeClasses.length > 0) {
                        const totalInscritos = activeClasses.reduce((sum, c) => sum + c.usuariosInscritos.length, 0);
                        const totalCapacidad = activeClasses.reduce((sum, c) => sum + c.capacidad, 0);
                        dayClass = getOccupancyClass(totalInscritos, totalCapacidad);
                    }

                    return (
                        <div key={index} 
                             className={`calendar-day ${day.isCurrentMonth ? '' : 'calendar-other-month'} ${day.date.toDateString() === new Date().toDateString() ? 'calendar-today' : ''} ${selectedDate?.toDateString() === day.date.toDateString() ? 'calendar-selected-day' : ''} ${dayClass}`}
                             onClick={() => handleDayClick(day.date)}>
                            {day.date.getDate()}
                            {hasClasses && !allCanceled && <div className="calendar-dot"></div>}
                        </div>
                    );
                })}
            </div>

            {selectedDate && (
                <div className="selected-day-classes-list">
                    <div className="list-header-with-filter">
                        <h5>Clases para el {selectedDate.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' })}:</h5>
                        <div className="list-filter">
                            <label htmlFor="list-class-filter">Filtrar:</label>
                            <select id="list-class-filter" value={listTypeFilter} onChange={(e) => setListTypeFilter(e.target.value)} className="form-input">
                                <option value="all">Todas</option>
                                {(classTypes || []).map(type => (<option key={type._id} value={type._id}>{type.nombre}</option>))}
                            </select>
                        </div>
                    </div>
                    
                    {filteredClassesForList.length === 0 
                        ? <p className="no-classes-message">No hay clases que coincidan con el filtro.</p>
                        : <ul>
                            {/* --- ORDENAMIENTO POR HORA APLICADO AQUÍ --- */}
                            {[...filteredClassesForList]
                                .sort((a, b) => a.horaInicio.localeCompare(b.horaInicio))
                                .map(clase => {
                                    const occupancyClass = getOccupancyClass(clase.usuariosInscritos.length, clase.capacidad);
                                    const classTypeName = classTypes.find(type => type._id === clase.tipoClase?._id)?.nombre || 'N/A';

                                    return (
                                        <li key={clase._id} className={`class-item ${clase.estado === 'cancelada' ? 'is-canceled' : occupancyClass}`}>
                                            <div className="class-item-header">
                                                <p className="class-title">{clase.nombre} ({classTypeName})</p>
                                                <p className="class-details">Estado: <span className={`status-badge status-${clase.estado}`}>{clase.estado}</span></p>
                                            </div>
                                            <p className="class-details">Profesor: {clase.profesor ? `${clase.profesor.nombre} ${clase.profesor.apellido}` : 'No asignado'}</p>
                                            <p className="class-details">Horario: {clase.horarioFijo || `${clase.horaInicio || ''} - ${clase.horaFin || ''}`}</p>
                                            <p className="class-details">Ocupación: {clase.usuariosInscritos.length}/{clase.capacidad}</p>
                                            <div className="class-actions">
                <button onClick={() => onViewRoster(clase._id)} className="btn btn-sm info">Ver Inscriptos</button>
                
                {clase.estado !== 'cancelada'
                    ? (<><button onClick={() => onEditClass(clase)} className="btn btn-sm primary1">Editar</button><button onClick={() => onCancelClass(clase)} className="btn btn-sm warning">Cancelar</button></>)
                    : <button onClick={() => onReactivateClass(clase)} className="btn btn-sm info">Reactivar</button>
                }
                <button onClick={() => onDeleteClass(clase._id)} className="btn btn-sm danger">Eliminar</button>
            </div>
                                            
                                        </li>
                                    );
                                })}
                          </ul>
                    }
                </div>
            )}
        </div>
    );
}

export default ClassCalendar;