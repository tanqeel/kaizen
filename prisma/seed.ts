/**
 * Kaizen demo seed — "Kaizen Model School".
 * Deterministic (seeded PRNG) so every reset produces the same demo state.
 * Run: npx prisma db seed
 */
import { PrismaClient } from '@prisma/client';
import { hashPassword } from '../lib/password';

const prisma = new PrismaClient();
const PKT = 'Asia/Karachi';

// ── deterministic PRNG ──────────────────────────────────────────────
function mulberry32(seed: number) {
  return function () {
    let t = (seed += 0x6d2d6959);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rand = mulberry32(20260928);
const pick = <T,>(arr: T[]): T => arr[Math.floor(rand() * arr.length)];
const int = (min: number, max: number) => Math.floor(rand() * (max - min + 1)) + min;
/** Remark matched to marks so report cards never praise a failing mark (mirrors lib/exams remarkFor). */
function remarkForMarks(marks: number): string {
  if (marks >= 90) return 'Outstanding work';
  if (marks >= 80) return 'Excellent work';
  if (marks >= 70) return 'Good effort';
  if (marks >= 60) return 'Satisfactory — keep improving';
  if (marks >= 50) return 'Needs more practice';
  return 'Needs significant improvement';
}

// ── PKT date helpers (dates stored as YYYY-MM-DD strings, instants as UTC) ──
function pktDate(d = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: PKT, year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(d);
}
function pktAt(totalMinutes: number, d = new Date()): Date {
  const ds = pktDate(d);
  const hh = String(Math.floor(totalMinutes / 60)).padStart(2, '0');
  const mm = String(totalMinutes % 60).padStart(2, '0');
  return new Date(`${ds}T${hh}:${mm}:00+05:00`);
}
function fmtTimePKT(d: Date): string {
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: PKT, hour: '2-digit', minute: '2-digit',
  }).format(d);
}

// ── name pools ──────────────────────────────────────────────────────
const BOYS = ['Ahmed','Ali','Bilal','Danish','Fahad','Hamza','Imran','Junaid','Kamran','Noman','Omar','Qasim','Sajid','Tariq','Usman','Waqas','Yasir','Zubair','Adeel','Farhan'];
const GIRLS = ['Ayesha','Fatima','Hina','Iqra','Mahnoor','Nimra','Rabia','Sadia','Sana','Zainab','Maryam','Khadija','Asma','Bushra','Farah'];
const SURNAMES = ['Khan','Ahmed','Malik','Raza','Sheikh','Butt','Chaudhry','Farooq','Hussain','Iqbal','Mahmood','Nadeem','Qureshi','Siddiqui'];
const TEACHER_NAMES = ['Asif Mehmood','Saima Raza','Tariq Aziz','Nadia Khan','Faisal Iqbal','Rubina Ahmed','Kamran Shah','Shazia Malik','Adnan Farooq','Huma Tariq'];
const STAFF = [
  { name: 'Rashid Mehmood', designation: 'Accountant' },
  { name: 'Farah Naz', designation: 'Librarian' },
  { name: 'Ghulam Abbas', designation: 'Driver' },
  { name: 'Shabana Kosar', designation: 'Office Assistant' },
];
const SUBJECTS = [
  { name: 'English', code: 'ENG' },
  { name: 'Mathematics', code: 'MATH' },
  { name: 'Science', code: 'SCI' },
  { name: 'Urdu', code: 'URD' },
  { name: 'Computer', code: 'COMP' },
  { name: 'Islamiat', code: 'ISL' },
];
const PERIOD_TIMES: Array<[string, string]> = [
  ['08:00', '08:50'], ['08:55', '09:45'], ['09:50', '10:40'],
  ['11:00', '11:50'], ['11:55', '12:45'], ['12:50', '13:40'],
];

const DEMO_PASSWORD = 'demo1234';

async function main() {
  const today = pktDate();
  const now = new Date();
  const demoHash = hashPassword(DEMO_PASSWORD);

  // ── wipe (reverse dependency order) ──
  await prisma.aiUsageLog.deleteMany();
  await prisma.aiMessage.deleteMany();
  await prisma.aiConversation.deleteMany();
  await prisma.notificationLog.deleteMany();
  await prisma.smsTemplate.deleteMany();
  await prisma.announcement.deleteMany();
  await prisma.diaryEntry.deleteMany();
  await prisma.payment.deleteMany();
  await prisma.feeVoucherLine.deleteMany();
  await prisma.feeVoucher.deleteMany();
  await prisma.feeHead.deleteMany();
  await prisma.expense.deleteMany();
  await prisma.budget.deleteMany();
  await prisma.paymentSource.deleteMany();
  await prisma.expenseHead.deleteMany();
  await prisma.examResult.deleteMany();
  await prisma.examSchedule.deleteMany();
  await prisma.examTerm.deleteMany();
  await prisma.periodAttendance.deleteMany();
  await prisma.attendanceConflict.deleteMany();
  await prisma.gateCheckOut.deleteMany();
  await prisma.gateCheckIn.deleteMany();
  await prisma.biometricTerminal.deleteMany();
  await prisma.timetableSlot.deleteMany();
  await prisma.subjectAllocation.deleteMany();
  await prisma.studentParent.deleteMany();
  await prisma.student.deleteMany();
  await prisma.parent.deleteMany();
  await prisma.section.deleteMany();
  await prisma.grade.deleteMany();
  await prisma.subject.deleteMany();
  await prisma.teacher.deleteMany();
  await prisma.staffMember.deleteMany();
  await prisma.sessionToken.deleteMany();
  await prisma.user.deleteMany();
  await prisma.shift.deleteMany();
  await prisma.academicSession.deleteMany();
  await prisma.school.deleteMany();

  // ── school / session / shifts ──
  const school = await prisma.school.create({
    data: {
      name: 'Kaizen Model School',
      address: 'Main Road, Multan, Punjab, Pakistan',
      phone: '061-1234567',
      email: 'info@kaizenmodelschool.pk',
      timezone: PKT,
    },
  });
  const session = await prisma.academicSession.create({
    data: {
      schoolId: school.id, name: '2025-26', term: 'Fall',
      startDate: new Date('2025-08-01T00:00:00+05:00'),
      endDate: new Date('2026-05-31T00:00:00+05:00'),
      isCurrent: true,
    },
  });
  const morning = await prisma.shift.create({ data: { schoolId: school.id, name: 'Morning' } });
  await prisma.shift.create({ data: { schoolId: school.id, name: 'Evening' } });

  // ── users: super admin + principal ──
  const superAdmin = await prisma.user.create({
    data: { name: 'Super Admin', email: 'superadmin@kaizen.pk', passwordHash: demoHash, role: 'SUPER_ADMIN', phone: '0300-0000001' },
  });
  const principalUser = await prisma.user.create({
    data: { name: 'Principal A. Rehman', email: 'principal@kaizen.pk', passwordHash: demoHash, role: 'PRINCIPAL', phone: '0300-0000002' },
  });

  // ── teachers (+ logins) ──
  const teachers: Array<{ id: string; userId: string }> = [];
  for (let i = 0; i < TEACHER_NAMES.length; i++) {
    const user = await prisma.user.create({
      data: {
        name: TEACHER_NAMES[i], email: `teacher${i + 1}@kaizen.pk`,
        passwordHash: demoHash, role: 'TEACHER', phone: `0301-10000${String(i + 1).padStart(2, '0')}`,
      },
    });
    const t = await prisma.teacher.create({
      data: {
        userId: user.id, employeeId: `T-${String(i + 1).padStart(3, '0')}`,
        phone: user.phone!, hireDate: new Date('2023-04-01T00:00:00+05:00'),
        salaryMonthly: 45000 + i * 3500, isActive: true,
      },
    });
    teachers.push({ id: t.id, userId: user.id });
  }

  // ── operational staff (+ logins) ──
  for (let i = 0; i < STAFF.length; i++) {
    const user = await prisma.user.create({
      data: {
        name: STAFF[i].name, email: `staff${i + 1}@kaizen.pk`,
        passwordHash: demoHash, role: 'STAFF', phone: `0302-20000${String(i + 1).padStart(2, '0')}`,
      },
    });
    await prisma.staffMember.create({
      data: {
        userId: user.id, employeeId: `S-${String(i + 1).padStart(3, '0')}`,
        designation: STAFF[i].designation, phone: user.phone!,
        hireDate: new Date('2022-04-01T00:00:00+05:00'),
        salaryMonthly: 35000 + i * 2000, isActive: true,
      },
    });
  }

  // ── subjects ──
  const subjects: Array<{ id: string; name: string; code: string }> = [];
  for (const s of SUBJECTS) {
    subjects.push(await prisma.subject.create({ data: { schoolId: school.id, ...s } }));
  }

  // ── grades + sections ──
  const grades: Array<{ id: string; level: number }> = [];
  const sections: Array<{ id: string; gradeId: string; level: number; name: string }> = [];
  for (let level = 1; level <= 5; level++) {
    const grade = await prisma.grade.create({
      data: { schoolId: school.id, level, name: `Grade ${level}` },
    });
    grades.push({ id: grade.id, level });
    const sectionNames = level <= 3 ? ['A', 'B', 'C'] : ['A', 'B'];
    for (let si = 0; si < sectionNames.length; si++) {
      const sec = await prisma.section.create({
        data: {
          gradeId: grade.id, name: sectionNames[si],
          room: `R-${level}${sectionNames[si]}`,
          classTeacherId: teachers[(level + si) % teachers.length].id,
        },
      });
      sections.push({ id: sec.id, gradeId: grade.id, level, name: sectionNames[si] });
    }
  }

  // ── students + parents (+ logins) ──
  const students: Array<{ id: string; name: string; sectionId: string; gradeId: string; level: number }> = [];
  const parents: Array<{ id: string; userId: string }> = [];
  let n = 0;
  for (const sec of sections) {
    for (let k = 1; k <= 5; k++) {
      n++;
      const isBoy = rand() < 0.5;
      const name = `${pick(isBoy ? BOYS : GIRLS)} ${pick(SURNAMES)}`;
      const parentName = `${pick([...BOYS, ...GIRLS])} ${pick(SURNAMES)}`;
      const parentUser = await prisma.user.create({
        data: {
          name: parentName, email: `parent${n}@kaizen.pk`,
          passwordHash: demoHash, role: 'PARENT', phone: `0303-3${String(100000 + n).slice(1)}`,
        },
      });
      const parent = await prisma.parent.create({
        data: {
          userId: parentUser.id, name: parentName, phone: parentUser.phone!,
          cnic: `36302-${String(1000000 + int(0, 8999999))}-${int(1, 9)}`,
          address: 'House 12, Gulgasht Colony, Multan',
        },
      });
      parents.push({ id: parent.id, userId: parentUser.id });
      const student = await prisma.student.create({
        data: {
          admissionNo: `KZN-25-${sec.level}${sec.name}${k}`,
          name, gender: isBoy ? 'Male' : 'Female',
          dob: new Date(`${2019 - sec.level}-0${int(1, 9)}-1${int(0, 9)}T00:00:00+05:00`),
          bForm: `36302-${String(1000000 + int(0, 8999999))}-${int(1, 9)}`,
          gradeId: sec.gradeId, sectionId: sec.id,
          shiftId: morning.id, sessionId: session.id,
          address: 'House 12, Gulgasht Colony, Multan',
          isActive: true,
        },
      });
      await prisma.studentParent.create({
        data: { studentId: student.id, parentId: parent.id, relation: 'Guardian' },
      });
      students.push({ id: student.id, name, sectionId: sec.id, gradeId: sec.gradeId, level: sec.level });
    }
  }

  // one STUDENT-role login linked to the first student
  const studentUser = await prisma.user.create({
    data: {
      name: students[0].name, email: 'student1@kaizen.pk',
      passwordHash: demoHash, role: 'STUDENT', phone: '0303-3000001',
    },
  });
  await prisma.student.update({ where: { id: students[0].id }, data: { userId: studentUser.id } });

  console.log(`Seeded: 1 school, ${grades.length} grades, ${sections.length} sections, ${students.length} students, ${teachers.length} teachers`);

  // ── subject allocations (grade × subject → teacher) ──
  const allocationTeacher = new Map<string, { id: string; userId: string }>();
  for (const g of grades) {
    for (let si = 0; si < subjects.length; si++) {
      const t = teachers[(si + g.level) % teachers.length];
      await prisma.subjectAllocation.create({
        data: {
          subjectId: subjects[si].id, gradeId: g.id,
          teacherId: t.id, periodsPerWeek: 5,
        },
      });
      allocationTeacher.set(`${subjects[si].id}:${g.id}`, t);
    }
  }

  // ── weekly timetable (Mon–Fri, 6 periods, rotated subject order) ──
  for (let sIdx = 0; sIdx < sections.length; sIdx++) {
    const sec = sections[sIdx];
    for (let dow = 1; dow <= 5; dow++) {
      for (let p = 1; p <= 6; p++) {
        const subj = subjects[(p - 1 + sIdx) % subjects.length];
        const t = allocationTeacher.get(`${subj.id}:${sec.gradeId}`)!;
        await prisma.timetableSlot.create({
          data: {
            sectionId: sec.id, dayOfWeek: dow, periodNo: p,
            subjectId: subj.id, teacherId: t.id,
            room: `R-${sec.level}${sec.name}`,
            startTime: PERIOD_TIMES[p - 1][0], endTime: PERIOD_TIMES[p - 1][1],
          },
        });
      }
    }
  }
  console.log('Seeded: allocations + timetable');

  // ── exam term + schedules + results (Grade 5-A) ──
  const examTerm = await prisma.examTerm.create({
    data: {
      sessionId: session.id, name: 'First Term',
      startDate: new Date('2026-10-05T00:00:00+05:00'),
      endDate: new Date('2026-10-20T00:00:00+05:00'),
    },
  });
  const grade5 = grades.find((g) => g.level === 5)!;
  const grade5A = sections.find((s) => s.level === 5 && s.name === 'A')!;
  const grade5AStudents = students.filter((s) => s.sectionId === grade5A.id);
  const examSchedules: Array<{ id: string; subjectId: string }> = [];
  for (let si = 0; si < subjects.length; si++) {
    const sched = await prisma.examSchedule.create({
      data: {
        examTermId: examTerm.id, subjectId: subjects[si].id, gradeId: grade5.id,
        date: new Date(`2026-10-${String(5 + si).padStart(2, '0')}T00:00:00+05:00`),
        startTime: '09:00', totalMarks: 100,
      },
    });
    examSchedules.push({ id: sched.id, subjectId: subjects[si].id });
  }
  for (const sched of examSchedules) {
    for (const st of grade5AStudents) {
      const marks = int(55, 98);
      await prisma.examResult.create({
        data: {
          examScheduleId: sched.id, studentId: st.id,
          obtainedMarks: marks,
          remarks: remarkForMarks(marks),
        },
      });
    }
  }
  console.log('Seeded: exam term, schedules, results');

  // ── fee heads + monthly vouchers + payments ──
  const tuitionHeads = new Map<number, { id: string }>();
  for (const g of grades) {
    tuitionHeads.set(
      g.level,
      await prisma.feeHead.create({
        data: { schoolId: school.id, name: `Tuition Fee (Grade ${g.level})`, defaultAmount: 2200 + g.level * 400, gradeId: g.id },
      }),
    );
  }
  const examHead = await prisma.feeHead.create({ data: { schoolId: school.id, name: 'Exam Fee', defaultAmount: 800 } });
  const labHead = await prisma.feeHead.create({ data: { schoolId: school.id, name: 'Computer Lab Fee', defaultAmount: 600 } });

  const dNow = new Date();
  const [yearStr, monthStr] = new Intl.DateTimeFormat('en-CA', { timeZone: PKT, year: 'numeric', month: '2-digit' }).format(dNow).split('-');
  const year = parseInt(yearStr, 10);
  const month = parseInt(monthStr, 10);
  const dueDate = new Date(`${year}-${String(month).padStart(2, '0')}-10T00:00:00+05:00`);
  const paymentMethods = ['CASH', 'BANK_TRANSFER', 'JAZZCASH', 'EASYPAISA', 'KUICKPAY_1LINK'] as const;
  const staffUser = await prisma.user.findFirst({ where: { role: 'STAFF' } });

  let vi = 0;
  for (const st of students) {
    const tuition = 2200 + st.level * 400;
    const total = tuition + 800 + 600;
    const voucher = await prisma.feeVoucher.create({
      data: {
        studentId: st.id, sessionId: session.id, month, year, dueDate,
        totalAmount: total, status: 'UNPAID',
        lines: {
          create: [
            { feeHeadId: tuitionHeads.get(st.level)!.id, amount: tuition },
            { feeHeadId: examHead.id, amount: 800 },
            { feeHeadId: labHead.id, amount: 600 },
          ],
        },
      },
    });
    const bucket = vi % 10;
    if (bucket < 6) {
      await prisma.payment.create({
        data: {
          voucherId: voucher.id, amount: total, method: pick([...paymentMethods]),
          reference: `RCP-${String(vi + 1).padStart(4, '0')}`,
          receivedById: staffUser?.id, paidAt: pktAt(int(540, 780)),
        },
      });
      await prisma.feeVoucher.update({ where: { id: voucher.id }, data: { status: 'PAID' } });
    } else if (bucket < 8) {
      const part = Math.round(total * 0.6);
      await prisma.payment.create({
        data: {
          voucherId: voucher.id, amount: part, method: pick([...paymentMethods]),
          reference: `RCP-${String(vi + 1).padStart(4, '0')}`,
          receivedById: staffUser?.id, paidAt: pktAt(int(540, 780)),
        },
      });
      await prisma.feeVoucher.update({ where: { id: voucher.id }, data: { status: 'PARTIAL' } });
    }
    vi++;
  }
  console.log('Seeded: fee vouchers + payments');

  // ── biometric terminal ──
  const terminal = await prisma.biometricTerminal.create({
    data: {
      schoolId: school.id, name: 'Main Gate',
      ipAddress: '192.168.1.201', port: 4370,
      status: 'ONLINE', lastHeartbeat: now,
    },
  });

  // ── gate check-ins / check-outs (today) ──
  const checkedIn = new Set<string>();
  const checkInRows: Array<{ studentId: string; date: string; checkInTime: Date; method: any; terminalId: string; createdById: string }> = [];
  const checkOutRows: Array<{ studentId: string; date: string; checkOutTime: Date; method: any; terminalId: string }> = [];
  const methods = ['FINGERPRINT', 'FACE', 'RFID'] as const;
  for (let i = 0; i < students.length; i++) {
    if (i % 5 === 4) continue; // 80% checked in
    const st = students[i];
    checkedIn.add(st.id);
    const mins = 455 + int(0, 45); // 07:35–08:20 PKT
    checkInRows.push({
      studentId: st.id, date: today, checkInTime: pktAt(mins),
      method: methods[i % 3], terminalId: terminal.id, createdById: superAdmin.id,
    });
    if (i % 3 === 0) {
      checkOutRows.push({
        studentId: st.id, date: today, checkOutTime: pktAt(825 + int(0, 30)),
        method: methods[i % 3], terminalId: terminal.id,
      });
    }
  }
  await prisma.gateCheckIn.createMany({ data: checkInRows });
  await prisma.gateCheckOut.createMany({ data: checkOutRows });

  // ── period attendance (today, all 6 periods) ──
  const periodRows: Array<{
    sectionId: string; subjectId: string; date: string; periodNo: number;
    studentId: string; status: any; markedById: string;
  }> = [];
  const markerId = teachers[0].userId;
  for (const sec of sections) {
    const secStudents = students.filter((s) => s.sectionId === sec.id);
    for (let p = 1; p <= 6; p++) {
      const subj = subjects[(p - 1 + sections.indexOf(sec)) % subjects.length];
      for (const st of secStudents) {
        const r = rand();
        const status = r < 0.88 ? 'PRESENT' : r < 0.95 ? 'ABSENT' : 'PENDING';
        periodRows.push({
          sectionId: sec.id, subjectId: subj.id, date: today, periodNo: p,
          studentId: st.id, status, markedById: markerId,
        });
      }
    }
  }
  await prisma.periodAttendance.createMany({ data: periodRows });

  // ── conflicts: gate-present + lecture-absent (3 open) ──
  const conflictStudents = [...checkedIn].slice(0, 3);
  for (const sid of conflictStudents) {
    const st = students.find((s) => s.id === sid)!;
    await prisma.periodAttendance.updateMany({
      where: { studentId: sid, date: today, periodNo: 2 },
      data: { status: 'ABSENT' },
    });
    await prisma.attendanceConflict.create({
      data: {
        date: today, studentId: sid,
        type: 'GATE_PRESENT_LECTURE_ABSENT', status: 'OPEN',
        note: `Checked in at gate but marked absent in period 2 (${st.name}).`,
      },
    });
  }
  console.log('Seeded: gate + period attendance + conflicts');

  // ── announcements + notification log + sms templates ──
  await prisma.announcement.createMany({
    data: [
      {
        schoolId: school.id, title: 'Admissions Open — Session 2026-27',
        body: 'Admissions for the new session are now open. Limited seats in Grades 1–5. Contact the school office for the admission form.',
        priority: 'NORMAL', audience: 'ALL', createdById: principalUser.id,
      },
      {
        schoolId: school.id, title: 'Parent-Teacher Meeting on Friday',
        body: 'All parents are requested to attend the PTM this Friday at 10:00 AM in the school hall. Report cards will be distributed.',
        priority: 'URGENT', audience: 'PARENTS', createdById: principalUser.id,
      },
      {
        schoolId: school.id, title: 'Staff meeting at 2:00 PM',
        body: 'Brief staff meeting in the principal office regarding the upcoming First Term exams.',
        priority: 'NORMAL', audience: 'STAFF', createdById: principalUser.id,
      },
    ],
  });
  const arrivalNotifs = checkInRows.slice(0, 20).map((c) => {
    const st = students.find((s) => s.id === c.studentId)!;
    return {
      studentId: c.studentId, type: 'ARRIVAL' as const, channel: 'IN_APP' as const,
      message: `${st.name} arrived at campus at ${fmtTimePKT(c.checkInTime)}.`,
      status: 'SENT' as const,
    };
  });
  const absentNotifs = students.filter((s) => !checkedIn.has(s.id)).slice(0, 2).map((st) => {
    const par = parents.find((p, idx) => students[idx].id === st.id);
    return {
      userId: par?.userId, studentId: st.id, type: 'LECTURE_ABSENCE' as const, channel: 'SMS' as const,
      message: `Dear parent, ${st.name} has not arrived at campus today (${today}). Please contact the school office.`,
      status: 'SENT' as const,
    };
  });
  await prisma.notificationLog.createMany({ data: [...arrivalNotifs, ...absentNotifs] });
  await prisma.smsTemplate.createMany({
    data: [
      { schoolId: school.id, name: 'Fee Reminder', body: 'Dear parent, fee voucher for {month} of Rs. {amount} for {student} is due on {due_date}. — Kaizen Model School' },
      { schoolId: school.id, name: 'Absence Alert', body: 'Dear parent, {student} was marked absent today ({date}). Please contact the school office. — Kaizen Model School' },
      { schoolId: school.id, name: 'Arrival Notice', body: '{student} arrived at campus at {time}. — Kaizen Model School' },
    ],
  });
  console.log('Seeded: announcements + notifications + templates');

  // ── class diary (today, first 8 sections) ──
  const diarySamples = [
    { taught: 'Fractions — addition and subtraction of like fractions', cw: 'Exercise 5.1, Q1–Q6 solved in class', hw: 'Exercise 5.1, Q7–Q12 — due tomorrow' },
    { taught: 'Reading comprehension — "The Honest Woodcutter"', cw: 'New vocabulary with Urdu meanings written in notebook', hw: 'Learn 10 new words and write 5 sentences' },
    { taught: 'Parts of plants — root, stem, leaf and flower', cw: 'Diagram of a plant labelled in notebook', hw: 'Draw and label the parts of a flower' },
    { taught: 'Multiplication tables 6 to 8', cw: 'Table test of 6 and 7 taken in class', hw: 'Learn table of 8, written twice' },
    { taught: 'Noun and its kinds — proper, common, collective', cw: 'Exercise: underline nouns in 10 sentences', hw: 'Write 5 examples of each kind of noun' },
    { taught: 'The water cycle — evaporation, condensation, rain', cw: 'Water cycle diagram drawn and explained', hw: 'Write 6 lines on why rain is important' },
  ];
  for (let di = 0; di < Math.min(8, sections.length); di++) {
    const sec = sections[di];
    const t = teachers[(sec.level + di) % teachers.length];
    const subj = subjects[di % subjects.length];
    const s = diarySamples[di % diarySamples.length];
    await prisma.diaryEntry.create({
      data: {
        schoolId: school.id, date: today, sectionId: sec.id,
        subjectId: subj.id, teacherId: t.id,
        taughtToday: s.taught, classwork: s.cw, homework: s.hw,
        note: di % 3 === 0 ? 'Short test on Friday — please revise this topic at home.' : null,
      },
    });
  }
  console.log('Seeded: class diary');

  // ── expenses, budgets ──
  const heads = await Promise.all(
    ['Salaries', 'Utilities', 'Stationery & Printing', 'Maintenance'].map((name) =>
      prisma.expenseHead.create({ data: { schoolId: school.id, name } }),
    ),
  );
  const sources = await Promise.all(
    ['Cash', 'Bank'].map((name) => prisma.paymentSource.create({ data: { schoolId: school.id, name } })),
  );
  const expenseDescs = ['Electricity bill', 'Water bill', 'Printing exam papers', 'Classroom repairs', 'Whiteboard markers', 'Internet bill'];
  for (let i = 0; i < 8; i++) {
    await prisma.expense.create({
      data: {
        schoolId: school.id,
        date: pktAt(int(540, 1000), new Date(now.getTime() - int(0, 20) * 86400000)),
        headId: heads[i % heads.length].id,
        sourceId: sources[i % 2].id,
        amount: int(2000, 45000),
        description: expenseDescs[i % expenseDescs.length],
        addedById: superAdmin.id,
      },
    });
  }
  for (const h of heads) {
    await prisma.budget.create({
      data: { schoolId: school.id, sessionId: session.id, headId: h.id, plannedAmount: int(200000, 900000) },
    });
  }
  console.log('Seeded: expenses + budgets');
  console.log('DONE. Demo logins (password: demo1234): superadmin, principal, teacher1..10, staff1..4, parent1..65, student1 @kaizen.pk');
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => { console.error(e); await prisma.$disconnect(); process.exit(1); });

