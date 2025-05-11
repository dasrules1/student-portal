-- Create tables for Education More portal

-- Users table
CREATE TABLE IF NOT EXISTS users (
  id UUID REFERENCES auth.users NOT NULL PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('student', 'teacher', 'admin')),
  avatar TEXT,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

-- RLS Policies for users table
CREATE POLICY "Users can view their own profile" 
  ON users FOR SELECT 
  USING (auth.uid() = id);

CREATE POLICY "Admin users can view all profiles" 
  ON users FOR SELECT 
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

CREATE POLICY "Admin users can insert users" 
  ON users FOR INSERT 
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

CREATE POLICY "Admin users can update users" 
  ON users FOR UPDATE 
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

CREATE POLICY "Users can update their own profile" 
  ON users FOR UPDATE 
  USING (auth.uid() = id);

-- Classes table
CREATE TABLE IF NOT EXISTS classes (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  name TEXT NOT NULL,
  subject TEXT,
  teacher_id UUID REFERENCES users(id) NOT NULL,
  location TEXT,
  meeting_day TEXT,
  start_time TEXT,
  end_time TEXT,
  virtual_link TEXT,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'archived')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE classes ENABLE ROW LEVEL SECURITY;

-- RLS Policies for classes table
CREATE POLICY "Teachers can view their own classes" 
  ON classes FOR SELECT 
  USING (teacher_id = auth.uid());

CREATE POLICY "Admin users can view all classes" 
  ON classes FOR SELECT 
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

CREATE POLICY "Teachers can insert their own classes" 
  ON classes FOR INSERT 
  WITH CHECK (
    teacher_id = auth.uid() OR 
    EXISTS (
      SELECT 1 FROM users
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

CREATE POLICY "Teachers can update their own classes" 
  ON classes FOR UPDATE 
  USING (
    teacher_id = auth.uid() OR 
    EXISTS (
      SELECT 1 FROM users
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

CREATE POLICY "Admin users can delete classes" 
  ON classes FOR DELETE 
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- Class enrollments table
CREATE TABLE IF NOT EXISTS class_enrollments (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  class_id UUID REFERENCES classes(id) NOT NULL,
  student_id UUID REFERENCES users(id) NOT NULL,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'completed')),
  grade TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(class_id, student_id)
);

-- Enable Row Level Security
ALTER TABLE class_enrollments ENABLE ROW LEVEL SECURITY;

-- RLS Policies for class_enrollments table
CREATE POLICY "Students can view their own enrollments" 
  ON class_enrollments FOR SELECT 
  USING (student_id = auth.uid());

CREATE POLICY "Teachers can view enrollments for their classes" 
  ON class_enrollments FOR SELECT 
  USING (
    EXISTS (
      SELECT 1 FROM classes
      WHERE classes.id = class_id AND classes.teacher_id = auth.uid()
    )
  );

CREATE POLICY "Admin users can view all enrollments" 
  ON class_enrollments FOR SELECT 
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

CREATE POLICY "Admin users can insert enrollments" 
  ON class_enrollments FOR INSERT 
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

CREATE POLICY "Teachers can insert enrollments for their classes" 
  ON class_enrollments FOR INSERT 
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM classes
      WHERE classes.id = class_id AND classes.teacher_id = auth.uid()
    )
  );

CREATE POLICY "Admin users can update enrollments" 
  ON class_enrollments FOR UPDATE 
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

CREATE POLICY "Teachers can update enrollments for their classes" 
  ON class_enrollments FOR UPDATE 
  USING (
    EXISTS (
      SELECT 1 FROM classes
      WHERE classes.id = class_id AND classes.teacher_id = auth.uid()
    )
  );

-- Curriculum table
CREATE TABLE IF NOT EXISTS curriculum (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  class_id UUID REFERENCES classes(id) NOT NULL,
  content JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(class_id)
);

-- Enable Row Level Security
ALTER TABLE curriculum ENABLE ROW LEVEL SECURITY;

-- RLS Policies for curriculum table
CREATE POLICY "Students can view curriculum for enrolled classes" 
  ON curriculum FOR SELECT 
  USING (
    EXISTS (
      SELECT 1 FROM class_enrollments
      WHERE class_enrollments.class_id = curriculum.class_id 
      AND class_enrollments.student_id = auth.uid()
      AND class_enrollments.status = 'active'
    )
  );

CREATE POLICY "Teachers can view curriculum for their classes" 
  ON curriculum FOR SELECT 
  USING (
    EXISTS (
      SELECT 1 FROM classes
      WHERE classes.id = class_id AND classes.teacher_id = auth.uid()
    )
  );

CREATE POLICY "Teachers can update curriculum for their classes" 
  ON curriculum FOR UPDATE 
  USING (
    EXISTS (
      SELECT 1 FROM classes
      WHERE classes.id = class_id AND classes.teacher_id = auth.uid()
    )
  );

CREATE POLICY "Admin users can view all curriculum" 
  ON curriculum FOR SELECT 
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

CREATE POLICY "Admin users can update all curriculum" 
  ON curriculum FOR UPDATE 
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- Assignments table
CREATE TABLE IF NOT EXISTS assignments (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  class_id UUID REFERENCES classes(id) NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  type TEXT NOT NULL CHECK (type IN ('homework', 'quiz', 'test', 'classwork', 'project')),
  due_date TIMESTAMP WITH TIME ZONE,
  points_possible INTEGER,
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'archived')),
  content JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE assignments ENABLE ROW LEVEL SECURITY;

-- RLS Policies for assignments table
CREATE POLICY "Students can view published assignments for enrolled classes" 
  ON assignments FOR SELECT 
  USING (
    status = 'published' AND
    EXISTS (
      SELECT 1 FROM class_enrollments
      WHERE class_enrollments.class_id = assignments.class_id 
      AND class_enrollments.student_id = auth.uid()
      AND class_enrollments.status = 'active'
    )
  );

CREATE POLICY "Teachers can view assignments for their classes" 
  ON assignments FOR SELECT 
  USING (
    EXISTS (
      SELECT 1 FROM classes
      WHERE classes.id = class_id AND classes.teacher_id = auth.uid()
    )
  );

CREATE POLICY "Teachers can insert assignments for their classes" 
  ON assignments FOR INSERT 
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM classes
      WHERE classes.id = class_id AND classes.teacher_id = auth.uid()
    )
  );

CREATE POLICY "Teachers can update assignments for their classes" 
  ON assignments FOR UPDATE 
  USING (
    EXISTS (
      SELECT 1 FROM classes
      WHERE classes.id = class_id AND classes.teacher_id = auth.uid()
    )
  );

CREATE POLICY "Admin users can view all assignments" 
  ON assignments FOR SELECT 
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

CREATE POLICY "Admin users can insert all assignments" 
  ON assignments FOR INSERT 
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

CREATE POLICY "Admin users can update all assignments" 
  ON assignments FOR UPDATE 
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- Submissions table
CREATE TABLE IF NOT EXISTS submissions (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  assignment_id UUID REFERENCES assignments(id) NOT NULL,
  student_id UUID REFERENCES users(id) NOT NULL,
  content JSONB NOT NULL DEFAULT '{}'::jsonb,
  status TEXT DEFAULT 'submitted' CHECK (status IN ('draft', 'submitted', 'graded', 'returned')),
  score INTEGER,
  feedback TEXT,
  submitted_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  graded_at TIMESTAMP WITH TIME ZONE,
  UNIQUE(assignment_id, student_id)
);

-- Enable Row Level Security
ALTER TABLE submissions ENABLE ROW LEVEL SECURITY;

-- RLS Policies for submissions table
CREATE POLICY "Students can view their own submissions" 
  ON submissions FOR SELECT 
  USING (student_id = auth.uid());

CREATE POLICY "Students can insert their own submissions" 
  ON submissions FOR INSERT 
  WITH CHECK (student_id = auth.uid());

CREATE POLICY "Students can update their own draft submissions" 
  ON submissions FOR UPDATE 
  USING (student_id = auth.uid() AND status = 'draft');

CREATE POLICY "Teachers can view submissions for their assignments" 
  ON submissions FOR SELECT 
  USING (
    EXISTS (
      SELECT 1 FROM assignments
      JOIN classes ON assignments.class_id = classes.id
      WHERE assignments.id = assignment_id AND classes.teacher_id = auth.uid()
    )
  );

CREATE POLICY "Teachers can update submissions for their assignments" 
  ON submissions FOR UPDATE 
  USING (
    EXISTS (
      SELECT 1 FROM assignments
      JOIN classes ON assignments.class_id = classes.id
      WHERE assignments.id = assignment_id AND classes.teacher_id = auth.uid()
    )
  );

CREATE POLICY "Admin users can view all submissions" 
  ON submissions FOR SELECT 
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

CREATE POLICY "Admin users can update all submissions" 
  ON submissions FOR UPDATE 
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- Activity logs table
CREATE TABLE IF NOT EXISTS activity_logs (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES users(id),
  action TEXT NOT NULL,
  entity_type TEXT,
  entity_id UUID,
  details JSONB,
  ip_address TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE activity_logs ENABLE ROW LEVEL SECURITY;

-- RLS Policies for activity_logs table
CREATE POLICY "Users can view their own activity logs" 
  ON activity_logs FOR SELECT 
  USING (user_id = auth.uid());

CREATE POLICY "Admin users can view all activity logs" 
  ON activity_logs FOR SELECT 
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

CREATE POLICY "System can insert activity logs" 
  ON activity_logs FOR INSERT 
  WITH CHECK (true);
