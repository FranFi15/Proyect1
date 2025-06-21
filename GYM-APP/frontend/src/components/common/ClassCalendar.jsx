import React, { useState, useEffect, useMemo } from 'react';
import '../../styles/Calendar.css';

const getDayName = (dayIndex) => {
    const days = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
    return days[dayIndex];
};


function ClassCalendar({ classes, onEditClass, onCancelClass, onDeleteClass, onReactivateClass, classTypes, getColorForClassType }) {
    const [currentDate, setCurrentDate] = useState(new Date()); 
    const [selectedDayClasses, setSelectedDayClasses] = useState([]); 
    const [selectedDate, setSelectedDate] = useState(null); 

    const getMonthName = (date) => {
        return date.toLocaleString('es-ES', { month: 'long', year: 'numeric' });
    };

    const classesByDay = useMemo(() => {
        const map = new Map();
        (classes || []).forEach(clase => {
            const classDate = clase.fecha ? new Date(clase.fecha) : null;
            if (classDate) {
                // No es necesario normalizar aquí si ya se guarda como UTC
                const dateKey = classDate.toISOString().substring(0, 10); 
                if (!map.has(dateKey)) {
                    map.set(dateKey, []);
                }
                const existingClassesForDay = map.get(dateKey);
                if (!existingClassesForDay.some(existingClase => existingClase._id === clase._id)) {
                    existingClassesForDay.push(clase);
                }
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
        const firstDayOfMonth = new Date(year, month, 1);
        const numDays = new Date(year, month + 1, 0).getDate();

        const days = [];
        const startDayIndex = firstDayOfMonth.getDay(); 
        const adjustedStartDayIndex = startDayIndex === 0 ? 6 : startDayIndex - 1; 

        const prevMonthLastDay = new Date(year, month, 0).getDate();
        for (let i = adjustedStartDayIndex; i > 0; i--) { 
            days.push({ date: new Date(year, month - 1, prevMonthLastDay - i + 1), isCurrentMonth: false });
        }
        for (let i = 1; i <= numDays; i++) {
            days.push({ date: new Date(year, month, i), isCurrentMonth: true });
        }
        let nextMonthDay = 1;
        while (days.length % 7 !== 0) {
            days.push({ date: new Date(year, month + 1, nextMonthDay), isCurrentMonth: false });
            nextMonthDay++;
        }
        return days;
    }, [currentDate]);

    const goToPreviousMonth = () => {
        setCurrentDate(prevDate => new Date(prevDate.getFullYear(), prevDate.getMonth() - 1, 1));
        setSelectedDayClasses([]); 
        setSelectedDate(null);
    };

    const goToNextMonth = () => {
        setCurrentDate(prevDate => new Date(prevDate.getFullYear(), prevDate.getMonth() + 1, 1));
        setSelectedDayClasses([]);
        setSelectedDate(null);
    };

    const handleDayClick = (dayDate) => {
        const dateKey = dayDate.toISOString().substring(0, 10);
        setSelectedDayClasses(classesByDay.get(dateKey) || []);
        setSelectedDate(dayDate);
    };

    return (
        <div className="calendar-container">
            <h3 className="calendar-title">Calendario de Clases</h3>

            <div className="calendar-navigation">
                <button onClick={goToPreviousMonth} className="calendar-btn">&lt; Mes Anterior</button>
                <h4 className="calendar-month-year">{getMonthName(currentDate)}</h4>
                <button onClick={goToNextMonth} className="calendar-btn">Mes Siguiente &gt;</button>
            </div>

            <div className="calendar-weekdays">
                <span>Lunes</span><span>Martes</span><span>Miércoles</span><span>Jueves</span><span>Viernes</span><span>Sábado</span><span>Domingo</span>
            </div>

            <div className="calendar-grid">
                {daysInMonth.map((day, index) => {
                    const dateKey = day.date.toISOString().substring(0, 10);
                    const hasClasses = classesByDay.has(dateKey);
                    const isToday = day.date.toDateString() === new Date().toDateString();
                    const isSelected = selectedDate && day.date.toDateString() === selectedDate.toDateString();

                    return (
                        <div key={index} className={`calendar-day ${day.isCurrentMonth ? 'calendar-current-month' : 'calendar-other-month'} ${isToday ? 'calendar-today' : ''} ${hasClasses ? 'calendar-has-classes' : ''} ${isSelected ? 'calendar-selected-day' : ''}`} onClick={() => handleDayClick(day.date)}>
                            {day.date.getDate()}
                            {hasClasses && <div className="calendar-dot"></div>}
                        </div>
                    );
                })}
            </div>

            {selectedDate && (
                <div className="selected-day-classes-list">
                    <h5 className="selected-day-classes-title">Clases para el {selectedDate.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}:</h5>
                    {selectedDayClasses.length === 0 ? (
                        <p className="no-classes-message">No hay clases programadas para este día.</p>
                    ) : (
                        <ul>
                            {selectedDayClasses.map(clase => {
                                const classTypeName = classTypes.find(type => type._id === clase.tipoClase?._id)?.nombre || clase.tipoClase?.nombre || 'N/A';
                                const classColor = getColorForClassType(clase.tipoClase?._id);
                                const diaDeLaClase = getDayName(new Date(clase.fecha).getUTCDay());
                                const horarioDeLaClase = clase.horarioFijo || `${clase.horaInicio || ''} - ${clase.horaFin || ''}`;

                                return (
                                    <li key={clase._id} className="class-item" style={{ '--class-item-bg-color': classColor }}>
                                        <p className="class-title">{clase.nombre} ({classTypeName})</p>
                                        <p className="class-details">Horario: {horarioDeLaClase}</p>
                                        <p className="class-details">Día: {diaDeLaClase}</p>
                                        <p className="class-details">Profesor: {clase.profesor?.nombre || 'N/A'} {clase.profesor?.apellido || ''}</p>
                                        <p className="class-details">Inscritos: {clase.usuariosInscritos.length}/{clase.capacidad}</p>
                                        <p className="class-details">Estado: <span className={`status-badge status-${clase.estado}`}>{clase.estado}</span></p>
                                        <div className="class-actions">
                                            {clase.estado !== 'cancelada' && (
                                                <>
                                                    <button onClick={() => onEditClass(clase)} className="btn btn-sm primary">Editar</button>
                                                    <button onClick={() => onCancelClass(clase)} className="btn btn-sm warning">Cancelar</button>
                                                </>
                                            )}
                                            {clase.estado === 'cancelada' && <button onClick={() => onReactivateClass(clase)} className="btn btn-sm info">Reactivar</button>}
                                            <button onClick={() => onDeleteClass(clase._id)} className="btn btn-sm danger">Eliminar</button>
                                        </div>
                                    </li>
                                );
                            })}
                        </ul>
                    )}
                </div>
            )}
        </div>
    );
}

export default ClassCalendar;