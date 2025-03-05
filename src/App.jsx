import React, { useState } from 'react';
import { useForm, Controller } from 'react-hook-form';
import {
  Button,
  Container,
  TextField,
  Typography,
  Grid,
  FormControlLabel,
  Switch,
  Select,
  MenuItem,
  IconButton,
  InputLabel,
  FormControl,
  Box,
  Stack,
  Accordion,
  AccordionSummary,
  AccordionDetails,
} from '@mui/material';
import { AddCircle, Delete, ExpandMore as ExpandMoreIcon } from '@mui/icons-material';
import { jsPDF } from 'jspdf';
import { autoTable } from 'jspdf-autotable';
import { LocalizationProvider, DatePicker } from '@mui/x-date-pickers';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import './styles.css';

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

function addDays(date, days) {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

function getStartOfWeek(date, weekStartsOn) {
  const currentDay = date.getDay();
  const diff = (currentDay - weekStartsOn + 7) % 7;
  return addDays(date, -diff);
}

function parseTime(timeStr, period, date, timeFormat) {
  let [hours, minutes] = timeStr.split(':').map(Number);
  if (timeFormat === '12') {
    if (period === 'PM' && hours < 12) hours += 12;
    if (period === 'AM' && hours === 12) hours = 0;
  }
  const newDate = new Date(date);
  newDate.setHours(hours, minutes, 0, 0);
  return newDate;
}

function calculateDailyHours(entries, breaks, date, timeFormat, breakMinutes, autoDeductBreaks) {
  let total = 0;
  entries.forEach(entry => {
    if (entry.start && entry.end) {
      const startTime = parseTime(entry.start, entry.startPeriod, date, timeFormat);
      const endTime = parseTime(entry.end, entry.endPeriod, date, timeFormat);
      const diff = (endTime - startTime) / (1000 * 60 * 60);
      if (diff > 0) {
        total += diff;
      }
    }
  });
  if (autoDeductBreaks) {
    total -= breakMinutes / 60;
  }
  return total > 0 ? total : 0;
}

function calculateOvertime(dailyHours, weekTotal, dailyThreshold, weeklyThreshold) {
  const dailyOT = dailyHours > dailyThreshold ? dailyHours - dailyThreshold : 0;
  const weeklyOT = weekTotal > weeklyThreshold ? weekTotal - weeklyThreshold : 0;
  return { dailyOT, weeklyOT };
}

function decimalToHHMM(decimal) {
  const hours = Math.floor(decimal);
  const minutes = Math.round((decimal - hours) * 60);
  return `${hours}:${minutes.toString().padStart(2, '0')}`;
}

const processEmployeeHours = (employee, settings) => {
  return employee.weeks.map((week) => {
    let weekRegular = 0,
      weekOvertime = 0,
      weekGross = 0;
    const days = week.days.map((day) => {
      const dailyHours = calculateDailyHours(
        day.entries,
        day.breaks,
        day.date,
        settings.timeFormat,
        settings.breakMinutes,
        settings.autoDeductBreaks
      );
      const weekTotal = weekRegular + dailyHours;
      const { dailyOT, weeklyOT } = calculateOvertime(
        dailyHours,
        weekTotal,
        settings.dailyOvertimeThreshold,
        settings.weeklyOvertimeThreshold
      );
      const regularHours = dailyHours - dailyOT;
      weekRegular += regularHours;
      weekOvertime += dailyOT + weeklyOT;
      const totalPay =
        regularHours * settings.payRate +
        (dailyOT + weeklyOT) * settings.payRate * settings.overtimeRate;
      weekGross += totalPay;
      return {
        date: day.date,
        regularHours,
        overtimeHours: dailyOT + weeklyOT,
        totalPay,
      };
    });
    return { days, weekRegular, weekOvertime, weekGross };
  });
};

const createNewEmployee = (settings) => {
  const startOfWeek = getStartOfWeek(new Date(), settings.weekStartsOn);
  return {
    id: Date.now() + Math.random(), // Ensure unique id
    name: '',
    startDate: new Date(),
    weeks: Array(settings.payPeriodWeeks)
      .fill()
      .map((_, weekIndex) => ({
        days: Array(settings.daysPerWeek)
          .fill()
          .map((_, dayIndex) => ({
            date: addDays(startOfWeek, weekIndex * 7 + dayIndex),
            entries: Array(settings.timePeriodsPerDay)
              .fill()
              .map(() => ({
                start: '',
                startPeriod: 'AM',
                end: '',
                endPeriod: 'AM',
              })),
            breaks: settings.autoDeductBreaks
              ? [{ start: '', startPeriod: 'AM', end: '', endPeriod: 'AM' }]
              : [],
          })),
      })),
  };
};

export default function App() {
  const { control, watch, setValue } = useForm({
    defaultValues: {
      timeFormat: '12',
      showAmPm: true,
      payPeriodWeeks: 2,
      daysPerWeek: 5,
      weekStartsOn: 0,
      timePeriodsPerDay: 2,
      autoDeductBreaks: false,
      breakMinutes: 0,
      nameDays: true,
      calculateOvertime: false,
      overtimeRule: 'standard',
      dailyOvertimeThreshold: 8,
      weeklyOvertimeThreshold: 40,
      overtimeRate: 1.5,
      payRate: 15.0,
      roundInterval: 15,
      displayDailyOT: true,
      employees: [
        createNewEmployee({
          payPeriodWeeks: 2,
          daysPerWeek: 5,
          weekStartsOn: 0,
          timePeriodsPerDay: 2,
          autoDeductBreaks: false,
        }),
      ],
    },
    mode: 'onChange',
  });

  const [settingsDirty, setSettingsDirty] = useState(false);

  const currentSettings = {
    timeFormat: watch('timeFormat'),
    showAmPm: watch('showAmPm'),
    payPeriodWeeks: watch('payPeriodWeeks'),
    daysPerWeek: watch('daysPerWeek'),
    weekStartsOn: watch('weekStartsOn'),
    timePeriodsPerDay: watch('timePeriodsPerDay'),
    autoDeductBreaks: watch('autoDeductBreaks'),
    breakMinutes: watch('breakMinutes'),
    nameDays: watch('nameDays'),
    calculateOvertime: watch('calculateOvertime'),
    overtimeRule: watch('overtimeRule'),
    dailyOvertimeThreshold: watch('dailyOvertimeThreshold'),
    weeklyOvertimeThreshold: watch('weeklyOvertimeThreshold'),
    overtimeRate: watch('overtimeRate'),
    payRate: watch('payRate'),
    roundInterval: watch('roundInterval'),
    displayDailyOT: watch('displayDailyOT'),
    date: watch('date'),
  };

  const employees = watch('employees');

  const addEmployee = () => {
    const newEmployee = createNewEmployee({
      payPeriodWeeks: currentSettings.payPeriodWeeks,
      daysPerWeek: currentSettings.daysPerWeek,
      weekStartsOn: currentSettings.weekStartsOn,
      timePeriodsPerDay: currentSettings.timePeriodsPerDay,
      autoDeductBreaks: currentSettings.autoDeductBreaks,
    });
    setValue('employees', [...employees, newEmployee]);
  };

  const removeEmployee = (index) => {
    setValue('employees', employees.filter((_, i) => i !== index));
  };

  const handleSaveSettings = () => {
    const updatedEmployees = employees.map((emp) => {
      return { ...emp, weeks: createNewEmployee(currentSettings).weeks };
    });
    setValue('employees', updatedEmployees);
    setSettingsDirty(false);
  };

  const generatePDF = () => {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    const margin = 10;
    const cellWidth = (pageWidth - 3 * margin) / 2;
    const cellHeight = 130; // Adjusted cell height to reduce spacing issue

    doc.setFontSize(16);
    doc.text('Employee Time Cards', margin, 10);

    employees.forEach((employee, i) => {
      if (i % 4 === 0 && i > 0) {
        doc.addPage();
      }
      const indexInPage = i % 4;
      const row = Math.floor(indexInPage / 2);
      const col = indexInPage % 2;
      const baseX = margin + col * (cellWidth + margin);
      const baseY = 20 + row * (cellHeight + margin);
      let currentY = baseY;

      // Employee Info Box
      doc.setFontSize(14);
      doc.text(`Employee: ${employee.name || 'Unnamed'}`, baseX, currentY + 5);
      currentY += 10;
      doc.setFontSize(12);
      const start_date = new Date(employee.startDate);
      doc.text(`Start Date: ${start_date.toLocaleDateString()}`, baseX, currentY);
      currentY += 7;

      // Process weekly data
      let overallDecimal = 0, overallGross = 0;
      let processedWeeks = [];
      employee.weeks.forEach((week, weekIndex) => {
        let weekTotal = 0, weekGross = 0;
        let weekData = { days: [] };

        week.days.forEach((day, dayIndex) => {
          const totalHours = calculateDailyHours(
            day.entries,
            day.breaks,
            day.date,
            currentSettings.timeFormat,
            currentSettings.breakMinutes,
            currentSettings.autoDeductBreaks
          );
          weekTotal += totalHours;

          const { dailyOT, weeklyOT } = calculateOvertime(totalHours, weekTotal, currentSettings.dailyThreshold, currentSettings.weeklyThreshold);
          const regularHours = totalHours - dailyOT;
          const hourlyRate = currentSettings.payRate || 0;
          const overtimeRate = currentSettings.overtimeRate || hourlyRate * 1.5; // Default OT rate = 1.5x regular

          const totalPay = (regularHours * hourlyRate) + (dailyOT * overtimeRate);
          weekGross += totalPay;

          weekData.days.push({
            date: addDays(start_date, dayIndex),
            regularHours,
            dailyOT,
            totalPay,
          });
        });

        overallDecimal += weekTotal;
        overallGross += weekGross;
        processedWeeks.push(weekData);
      });

      // Calculation Box (Placing before Employee Info Box)
      doc.setFontSize(10);

      processedWeeks.forEach((week, weekIndex) => {
        doc.setFontSize(10);
        doc.text(`Week ${weekIndex + 1}`, baseX, currentY);
        currentY += 4;
        const tableData = week.days.map((day) => [
          day.date.toLocaleDateString(),
          (day.regularHours + day.dailyOT).toFixed(2),
          decimalToHHMM(day.regularHours + day.dailyOT),
          `$${day.totalPay.toFixed(2)}`,
        ]);
        autoTable(doc, {
          startY: currentY,
          margin: { left: baseX },
          tableWidth: cellWidth,
          head: [['Date', 'Dec Hours', 'hh:mm', 'Pay']],
          body: tableData,
          styles: { fontSize: 8 },
          headStyles: { fillColor: [200, 200, 200], textColor: 0, fontSize: 9 },
          theme: 'grid',
        });
        currentY = doc.lastAutoTable.finalY + 3;
      });

      doc.setFontSize(10);
      doc.text(`Final Totals (Decimal): ${overallDecimal.toFixed(2)} hrs`, baseX, currentY);
      doc.text(`Final Totals (hh:mm): ${decimalToHHMM(overallDecimal)}`, baseX, currentY + 5);
      doc.text(`Final Gross Pay: $${overallGross.toFixed(2)}`, baseX, currentY + 10);
    });

    doc.save('timecards.pdf');
  };
  const timeRegex =
    currentSettings.timeFormat === '12'
      ? /^(0?[1-9]|1[0-2]):[0-5][0-9]$/
      : /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/;

  return (
    <LocalizationProvider dateAdapter={AdapterDateFns}>
      <Container maxWidth="lg" className="container">
        <Box className="header" sx={{ mb: 4 }}>
          <Typography variant="h4" gutterBottom>
            Advanced Time Card Calculator
          </Typography>
        </Box>

        {/* Settings Accordion */}
        <Accordion defaultExpanded sx={{ mb: 4 }}>
          <AccordionSummary expandIcon={<ExpandMoreIcon />}>
            <Typography variant="h6">Settings</Typography>
          </AccordionSummary>
          <AccordionDetails>
            <Grid container spacing={3}>
              {/* Time Format */}
              <Grid item xs={12} md={4}>
                <FormControl fullWidth size="small">
                  <InputLabel>Time Format</InputLabel>
                  <Controller
                    name="timeFormat"
                    control={control}
                    rules={{ required: true }}
                    render={({ field }) => (
                      <Select
                        {...field}
                        label="Time Format"
                        onChange={(e) => {
                          field.onChange(e);
                          setSettingsDirty(true);
                        }}
                      >
                        <MenuItem value="12">12-hour</MenuItem>
                        <MenuItem value="24">24-hour</MenuItem>
                      </Select>
                    )}
                  />
                </FormControl>
              </Grid>
              {/* Hourly Pay */}
              <Grid item xs={12} md={4}>
                <Controller
                  name="payRate"
                  control={control}
                  rules={{ required: true, min: 0 }}
                  render={({ field, fieldState }) => (
                    <TextField
                      {...field}
                      label="Hourly Pay"
                      type="number"
                      fullWidth
                      size="small"
                      error={!!fieldState.error}
                      helperText={fieldState.error ? fieldState.error.message : ''}
                      FormHelperTextProps={{ style: { margin: 0, minHeight: '1em' } }}
                      onChange={(e) => {
                        field.onChange(e);
                        setSettingsDirty(true);
                      }}
                    />
                  )}
                />
              </Grid>
              {/* Pay Period Weeks */}
              <Grid item xs={12} md={4}>
                <Controller
                  name="payPeriodWeeks"
                  control={control}
                  rules={{ required: true, min: 1, max: 4 }}
                  render={({ field, fieldState }) => (
                    <TextField
                      {...field}
                      label="Pay Period Weeks"
                      type="number"
                      fullWidth
                      size="small"
                      error={!!fieldState.error}
                      helperText={fieldState.error ? fieldState.error.message : ''}
                      FormHelperTextProps={{ style: { margin: 0, minHeight: '1em' } }}
                      onChange={(e) => {
                        field.onChange(e);
                        setSettingsDirty(true);
                      }}
                      inputProps={{ min: 1, max: 4 }}
                    />
                  )}
                />
              </Grid>
              {/* Days per Week */}
              <Grid item xs={12} md={4}>
                <Controller
                  name="daysPerWeek"
                  control={control}
                  rules={{ required: true, min: 1, max: 7 }}
                  render={({ field, fieldState }) => (
                    <TextField
                      {...field}
                      label="Days per Week"
                      type="number"
                      fullWidth
                      size="small"
                      error={!!fieldState.error}
                      helperText={fieldState.error ? fieldState.error.message : ''}
                      FormHelperTextProps={{ style: { margin: 0, minHeight: '1em' } }}
                      onChange={(e) => {
                        field.onChange(e);
                        setSettingsDirty(true);
                      }}
                      inputProps={{ min: 1, max: 7 }}
                    />
                  )}
                />
              </Grid>
              {/* Week Starts On */}
              <Grid item xs={12} md={4}>
                <FormControl fullWidth size="small">
                  <InputLabel>Week Starts On</InputLabel>
                  <Controller
                    name="weekStartsOn"
                    control={control}
                    rules={{ required: true }}
                    render={({ field }) => (
                      <Select
                        {...field}
                        label="Week Starts On"
                        onChange={(e) => {
                          field.onChange(e);
                          setSettingsDirty(true);
                        }}
                      >
                        {DAY_NAMES.map((day, index) => (
                          <MenuItem key={index} value={index}>
                            {day}
                          </MenuItem>
                        ))}
                      </Select>
                    )}
                  />
                </FormControl>
              </Grid>
              {/* Auto Deduct Breaks */}
              <Grid item xs={12} md={4}>
                <FormControlLabel
                  control={
                    <Controller
                      name="autoDeductBreaks"
                      control={control}
                      render={({ field }) => (
                        <Switch
                          {...field}
                          checked={field.value}
                          size="small"
                          onChange={(e) => {
                            field.onChange(e.target.checked);
                            setSettingsDirty(true);
                          }}
                        />
                      )}
                    />
                  }
                  label="Auto Deduct Breaks"
                />
              </Grid>
              {/* Break Minutes */}
              <Grid item xs={12} md={4}>
                <Controller
                  name="breakMinutes"
                  control={control}
                  rules={{ required: true, min: 0 }}
                  render={({ field, fieldState }) => (
                    <TextField
                      {...field}
                      label="Break Minutes"
                      type="number"
                      fullWidth
                      size="small"
                      error={!!fieldState.error}
                      helperText={fieldState.error ? fieldState.error.message : ''}
                      FormHelperTextProps={{ style: { margin: 0, minHeight: '1em' } }}
                      onChange={(e) => {
                        field.onChange(e);
                        setSettingsDirty(true);
                      }}
                    />
                  )}
                />
              </Grid>
              {/* Display Actual Weekday Names */}
              <Grid item xs={12} md={4}>
                <FormControlLabel
                  control={
                    <Controller
                      name="nameDays"
                      control={control}
                      render={({ field }) => (
                        <Switch
                          {...field}
                          checked={field.value}
                          size="small"
                          onChange={(e) => {
                            field.onChange(e.target.checked);
                            setSettingsDirty(true);
                          }}
                        />
                      )}
                    />
                  }
                  label="Display Actual Weekday Names"
                />
              </Grid>
              {/* Calculate Overtime */}
              <Grid item xs={12}>
                <Stack spacing={2}>
                  <FormControlLabel
                    control={
                      <Controller
                        name="calculateOvertime"
                        control={control}
                        render={({ field }) => (
                          <Switch
                            {...field}
                            checked={field.value}
                            size="small"
                            onChange={(e) => {
                              field.onChange(e.target.checked);
                              setSettingsDirty(true);
                            }}
                          />
                        )}
                      />
                    }
                    label="Calculate Overtime"
                  />
                  {watch('calculateOvertime') && (
                    <Grid container spacing={2}>
                      <Grid item xs={12} md={6}>
                        <Controller
                          name="dailyOvertimeThreshold"
                          control={control}
                          rules={{ required: true, min: 0 }}
                          render={({ field, fieldState }) => (
                            <TextField
                              {...field}
                              label="Daily OT Threshold (hrs)"
                              type="number"
                              fullWidth
                              size="small"
                              error={!!fieldState.error}
                              helperText={fieldState.error ? fieldState.error.message : ''}
                              FormHelperTextProps={{ style: { margin: 0, minHeight: '1em' } }}
                              onChange={(e) => {
                                field.onChange(e);
                                setSettingsDirty(true);
                              }}
                            />
                          )}
                        />
                      </Grid>
                      <Grid item xs={12} md={6}>
                        <Controller
                          name="weeklyOvertimeThreshold"
                          control={control}
                          rules={{ required: true, min: 0 }}
                          render={({ field, fieldState }) => (
                            <TextField
                              {...field}
                              label="Weekly OT Threshold (hrs)"
                              type="number"
                              fullWidth
                              size="small"
                              error={!!fieldState.error}
                              helperText={fieldState.error ? fieldState.error.message : ''}
                              FormHelperTextProps={{ style: { margin: 0, minHeight: '1em' } }}
                              onChange={(e) => {
                                field.onChange(e);
                                setSettingsDirty(true);
                              }}
                            />
                          )}
                        />
                      </Grid>
                    </Grid>
                  )}
                </Stack>
              </Grid>
            </Grid>
            <Box sx={{ mt: 2 }}>
              <Button
                variant="contained"
                color="primary"
                onClick={handleSaveSettings}
                disabled={!settingsDirty}
                size="small"
              >
                Save Settings
              </Button>
            </Box>
          </AccordionDetails>
        </Accordion>

        {/* Employees Section */}
        <Grid container spacing={2}>
          {employees.map((employee, empIndex) => (
            <Grid item xs={12} sm={6} md={4} key={employee.id}>
              <Box
                className="employee-card"
                sx={{
                  mb: 3,
                  p: 2,
                  bgcolor: 'background.paper',
                  borderRadius: 2,
                  boxShadow: 1,
                }}
              >
                <Grid container spacing={1} alignItems="center">
                  <Grid item xs={10}>
                    <Controller
                      name={`employees[${empIndex}].name`}
                      control={control}
                      render={({ field }) => (
                        <TextField {...field} label="Employee Name" fullWidth size="small" />
                      )}
                    />
                  </Grid>
                  <Grid item xs={2}>
                    <IconButton onClick={() => removeEmployee(empIndex)} color="error" size="small">
                      <Delete fontSize="small" />
                    </IconButton>
                  </Grid>
                </Grid>
                <Box sx={{ mt: 1 }}>
                  <Controller
                    name={`employees[${empIndex}].startDate`}
                    control={control}
                    render={({ field }) => (
                      <DatePicker
                        name='date'
                        label="Start Date"
                        value={field.value}
                        onChange={(date) => field.onChange(date)}
                        renderInput={(params) => (
                          <TextField
                            {...params}
                            fullWidth
                            size="small"
                            FormHelperTextProps={{ style: { margin: 0, minHeight: '1em' } }}
                          />
                        )}
                      />
                    )}
                  />
                </Box>
                {employee.weeks.map((week, weekIndex) => (
                  <Box key={weekIndex} sx={{ mt: 2 }}>
                    <Typography variant="subtitle2">Week {weekIndex + 1}</Typography>
                    {week.days.map((day, dayIndex) => (
                      <Box key={dayIndex} sx={{ mt: 1, p: 1, bgcolor: 'grey.100', borderRadius: 1 }}>
                        <Typography variant="caption">
                          {watch('nameDays')
                            ? DAY_NAMES[new Date(day.date).getDay()]
                            : `Day ${dayIndex + 1}`}
                        </Typography>
                        {day.entries.map((entry, entryIndex) => (
                          <Box key={entryIndex} sx={{ mt: 1 }}>
                            <Grid container spacing={1} alignItems="center">
                              <Grid item>
                                <Controller
                                  name={`employees[${empIndex}].weeks[${weekIndex}].days[${dayIndex}].entries[${entryIndex}].start`}
                                  control={control}
                                  rules={{
                                    required: 'Required',
                                    pattern: {
                                      value: timeRegex,
                                      message: 'Invalid time format',
                                    },
                                  }}
                                  render={({ field, fieldState }) => (
                                    <TextField
                                      {...field}
                                      label="In"
                                      size="small"
                                      error={!!fieldState.error}
                                      helperText={fieldState.error ? fieldState.error.message : ''}
                                      FormHelperTextProps={{ style: { margin: 0, minHeight: '1em' } }}
                                      style={{ width: '70px' }}
                                    />
                                  )}
                                />
                              </Grid>
                              <Grid item>
                                <Controller
                                  name={`employees[${empIndex}].weeks[${weekIndex}].days[${dayIndex}].entries[${entryIndex}].startPeriod`}
                                  control={control}
                                  render={({ field }) => (
                                    <FormControl size="small" style={{ width: '75px' }}>
                                      <InputLabel shrink>AP</InputLabel>
                                      <Select {...field} label="AP">
                                        <MenuItem value="AM">AM</MenuItem>
                                        <MenuItem value="PM">PM</MenuItem>
                                      </Select>
                                    </FormControl>
                                  )}
                                />
                              </Grid>
                              <Grid item>
                                <Controller
                                  name={`employees[${empIndex}].weeks[${weekIndex}].days[${dayIndex}].entries[${entryIndex}].end`}
                                  control={control}
                                  rules={{
                                    required: 'Required',
                                    pattern: {
                                      value: timeRegex,
                                      message: 'Invalid time format',
                                    },
                                  }}
                                  render={({ field, fieldState }) => (
                                    <TextField
                                      {...field}
                                      label="Out"
                                      size="small"
                                      error={!!fieldState.error}
                                      helperText={fieldState.error ? fieldState.error.message : ''}
                                      FormHelperTextProps={{ style: { margin: 0, minHeight: '1em' } }}
                                      style={{ width: '70px' }}
                                    />
                                  )}
                                />
                              </Grid>
                              <Grid item>
                                <Controller
                                  name={`employees[${empIndex}].weeks[${weekIndex}].days[${dayIndex}].entries[${entryIndex}].endPeriod`}
                                  control={control}
                                  render={({ field }) => (
                                    <FormControl size="small" style={{ width: '75px' }}>
                                      <InputLabel shrink>AP</InputLabel>
                                      <Select {...field} label="AP">
                                        <MenuItem value="AM">AM</MenuItem>
                                        <MenuItem value="PM">PM</MenuItem>
                                      </Select>
                                    </FormControl>
                                  )}
                                />
                              </Grid>
                            </Grid>
                          </Box>
                        ))}
                      </Box>
                    ))}
                  </Box>
                ))}
              </Box>
            </Grid>
          ))}
        </Grid>

        <Stack direction="row" spacing={2} sx={{ mt: 3 }}>
          <Button variant="contained" onClick={addEmployee} startIcon={<AddCircle />} size="small">
            Add Employee
          </Button>
          <Button variant="contained" color="success" onClick={generatePDF} size="small">
            Download PDF
          </Button>
        </Stack>
      </Container>
    </LocalizationProvider>
  );
}
