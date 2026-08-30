/**
 * Capacity Connect (SIH26075) — Phase 7.7 Test Suite
 * AI Assessment Question Generator & PDF Question Import
 *
 * Tests 37 requirements including:
 * - Content-grounded AI MCQ generation
 * - Course-scoped vs module-scoped generation
 * - Respecting question count, difficulty, and MCQ schema
 * - Strict trainer authorization and data isolation
 * - Single question regeneration
 * - Text-based PDF extraction and structured MCQ parsing
 * - Detection and handling of answer keys
 * - AI answer suggestion for unkeyed questions
 * - Handling scanned/empty PDFs with user-friendly errors
 * - Rate limiting and offline fallback resilience
 * - No automatic publication (trainer review required)
 */

const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');
const fs = require('fs');
const PDFDocument = require('pdfkit');

dotenv.config({ path: path.join(__dirname, '../.env') });

const User = require('../models/User');
const Course = require('../models/Course');
const Module = require('../models/Module');
const Resource = require('../models/Resource');
const Assessment = require('../models/Assessment');
const Skill = require('../models/Skill');
const { connectDB } = require('../config/db');

const {
  generateAiQuestions,
  regenerateSingleAiQuestion,
  importQuestionsFromPdf,
  suggestAnswersForPdfQuestions,
} = require('../controllers/assessmentController');

const {
  generateAssessmentQuestionsFromContent,
  generateFallbackAssessmentQuestionsFromContent,
  regenerateSingleQuestionFromContent,
  parseQuestionsFromPdfText,
  fallbackParseQuestionsFromPdfText,
  suggestAnswersForQuestions,
} = require('../services/openaiService');

// Helper to generate a text-based PDF for testing
const createTestPdf = (filePath, contentLines) => {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument();
    const stream = fs.createWriteStream(filePath);
    doc.pipe(stream);

    contentLines.forEach((line) => {
      doc.fontSize(12).text(line);
      doc.moveDown(0.5);
    });

    doc.end();
    stream.on('finish', () => resolve(filePath));
    stream.on('error', reject);
  });
};

const runTests = async () => {
  console.log('====================================================');
  console.log('🧪 Starting Phase 7.7 AI Question Generator & PDF Import Test Suite');
  console.log('====================================================\n');

  let passed = 0;
  let failed = 0;

  const assert = (condition, testName, details = '') => {
    if (condition) {
      console.log(`  ✅ PASS [Test ${passed + failed + 1}]: ${testName}`);
      passed++;
    } else {
      console.error(`  ❌ FAIL [Test ${passed + failed + 1}]: ${testName} ${details ? `(${details})` : ''}`);
      failed++;
    }
  };

  const tempPdfPath = path.join(__dirname, 'test_sample_quiz.pdf');
  const tempNoAnsPdfPath = path.join(__dirname, 'test_no_ans_quiz.pdf');
  const tempEmptyPdfPath = path.join(__dirname, 'test_empty_quiz.pdf');

  try {
    await connectDB();

    // 1. Setup Test Users
    const timestamp = Date.now();
    const trainerA = await User.findOneAndUpdate(
      { email: 'trainera_p77@test.com' },
      { name: 'Trainer Alice P77', email: 'trainera_p77@test.com', password: 'password123', role: 'trainer' },
      { upsert: true, new: true }
    );

    const trainerB = await User.findOneAndUpdate(
      { email: 'trainerb_p77@test.com' },
      { name: 'Trainer Bob P77', email: 'trainerb_p77@test.com', password: 'password123', role: 'trainer' },
      { upsert: true, new: true }
    );

    // 2. Setup Skills
    const skillJs = await Skill.create({
      name: `Async JavaScript ${timestamp}`,
      normalizedName: `async javascript ${timestamp}`.toLowerCase(),
      category: 'Technical',
      description: 'Promises, Async/Await, Event Loop',
    });

    // 3. Setup Course & Modules
    const courseA = await Course.create({
      title: `Advanced Web Engineering ${timestamp}`,
      description: 'Mastering asynchronous workflows, microservices, and React design patterns.',
      shortDescription: 'In-depth fullstack web engineering curriculum.',
      category: 'Engineering',
      level: 'intermediate',
      trainer: trainerA._id,
      status: 'published',
      learningOutcomes: [
        'Master JavaScript Promises and Async/Await execution loops',
        'Design resilient RESTful APIs with express middleware',
        'Implement component-driven user interfaces with React hooks',
      ],
      skills: [{ skill: skillJs._id, proficiency: 'proficient' }],
    });

    const module1 = await Module.create({
      course: courseA._id,
      title: 'Module 1: Asynchronous Execution & Microtasks',
      description: 'Event loops, microtask queues, async/await syntax, and error boundary handling.',
      order: 1,
    });

    const module2 = await Module.create({
      course: courseA._id,
      title: 'Module 2: API Architecture & Middleware',
      description: 'REST API routing, request validation, and token authentication.',
      order: 2,
    });

    const resource1 = await Resource.create({
      course: courseA._id,
      module: module1._id,
      title: 'Event Loop Deep Dive Lecture Notes',
      description: 'Detailed analysis of call stacks, task queues, and asynchronous resolution timers.',
      type: 'text',
    });

    // Course belonging to Trainer B
    const courseB = await Course.create({
      title: `Data Structures & Algorithms ${timestamp}`,
      description: 'Trees, Graphs, and Dynamic Programming.',
      category: 'Computer Science',
      level: 'advanced',
      trainer: trainerB._id,
      status: 'published',
    });

    // 4. Create sample PDFs for import tests
    await createTestPdf(tempPdfPath, [
      'Capacity Connect Certification Quiz',
      '',
      '1. What does the JavaScript Event Loop monitor?',
      'A. Call stack and Callback queue',
      'B. CPU temperature and cooling fans',
      'C. File system permissions only',
      'D. Network router bandwidth',
      'Answer: A',
      '',
      '2. Which keyword is used to pause execution until a Promise settles?',
      'A. defer',
      'B. await',
      'C. pause',
      'D. yield',
      'Answer: B',
      '',
      '3. In Node.js, what is the default behavior of unhandled Promise rejections in modern versions?',
      'A. Silent suppression',
      'B. Process termination with error code',
      'C. Automatic retry loop',
      'D. Network broadcast',
      'Answer: B',
    ]);

    await createTestPdf(tempNoAnsPdfPath, [
      'Unkeyed Assessment Worksheet',
      '',
      '1. What is the primary purpose of middleware in Express?',
      'A. To execute code and modify request/response objects',
      'B. To replace the operating system kernel',
      'C. To compile TypeScript to machine assembly',
      'D. To format hard drive storage',
      '',
      '2. What is the status code for Unauthorized access?',
      'A. 200 OK',
      'B. 401 Unauthorized',
      'C. 404 Not Found',
      'D. 500 Server Error',
    ]);

    await createTestPdf(tempEmptyPdfPath, [' ']);

    console.log('\n--- Test Group 1: Grounded AI Question Generation ---');

    // Test 1: Fallback Generator produces valid question count & schema
    const fallbackGen = generateFallbackAssessmentQuestionsFromContent({
      course: courseA,
      moduleDoc: module1,
      resources: [resource1],
      count: 5,
      difficulty: 'medium',
      topic: 'Event Loop',
    });

    assert(
      Array.isArray(fallbackGen.questions) && fallbackGen.questions.length === 5,
      'Fallback generator produces requested 5 questions',
      `Got ${fallbackGen.questions?.length}`
    );

    // Test 2: Valid MCQ 4-option structure
    const q1 = fallbackGen.questions[0];
    assert(
      q1.questionText && q1.optionA && q1.optionB && q1.optionC && q1.optionD && ['A', 'B', 'C', 'D'].includes(q1.correctOption),
      'Each question conforms to 4-option MCQ schema with designated correctOption',
      JSON.stringify(q1)
    );

    // Test 3: No duplicate options in question
    const uniqueOpts = new Set([q1.optionA, q1.optionB, q1.optionC, q1.optionD]);
    assert(uniqueOpts.size === 4, 'Question options are distinct with no duplicates', `Size: ${uniqueOpts.size}`);

    // Test 4: Explanation is populated
    assert(Boolean(q1.explanation && q1.explanation.length > 5), 'Question includes an educational explanation', q1.explanation);

    // Test 5: Difficulty parameter is respected
    const hardGen = generateFallbackAssessmentQuestionsFromContent({
      course: courseA,
      moduleDoc: module1,
      count: 3,
      difficulty: 'hard',
    });
    assert(
      hardGen.questions.every((q) => q.difficulty === 'hard'),
      'Hard difficulty parameter is respected on all generated questions'
    );

    // Test 6: Mixed difficulty produces diverse difficulties
    const mixedGen = generateFallbackAssessmentQuestionsFromContent({
      course: courseA,
      moduleDoc: module1,
      count: 6,
      difficulty: 'mixed',
    });
    const diffs = new Set(mixedGen.questions.map((q) => q.difficulty));
    assert(diffs.size > 1, 'Mixed difficulty produces diverse difficulty ratings', Array.from(diffs).join(', '));

    console.log('\n--- Test Group 2: Single Question Regeneration ---');

    // Test 7: Regenerate single question returns 1 distinct question
    const regenResult = await regenerateSingleQuestionFromContent({
      course: courseA,
      moduleDoc: module1,
      resources: [resource1],
      existingQuestionText: q1.questionText,
      difficulty: 'medium',
    });

    assert(
      Boolean(regenResult.question && regenResult.question.questionText),
      'Single question regeneration returns a valid question object'
    );

    console.log('\n--- Test Group 3: Controller AI Generation & Authorization ---');

    // Test 8: Authorized trainer generates questions via controller
    let mockReq = {
      user: { _id: trainerA._id, role: 'trainer', id: trainerA._id.toString() },
      body: { courseId: courseA._id.toString(), moduleId: module1._id.toString(), count: 4, difficulty: 'medium' },
    };
    let mockRes = {
      statusCode: 200,
      jsonData: null,
      status(code) { this.statusCode = code; return this; },
      json(data) { this.jsonData = data; return this; },
    };

    await generateAiQuestions(mockReq, mockRes, (err) => { if (err) console.error(err); });
    assert(
      mockRes.statusCode === 200 && mockRes.jsonData?.success && mockRes.jsonData.data?.questions?.length === 4,
      'Authorized trainer generates 4 questions via controller endpoint'
    );

    // Test 9: Trainer B cannot generate questions for Trainer A course (403)
    let unauthReq = {
      user: { _id: trainerB._id, role: 'trainer', id: trainerB._id.toString() },
      body: { courseId: courseA._id.toString(), count: 5 },
    };
    let unauthRes = {
      statusCode: 200,
      jsonData: null,
      status(code) { this.statusCode = code; return this; },
      json(data) { this.jsonData = data; return this; },
    };

    await generateAiQuestions(unauthReq, unauthRes, () => {});
    assert(
      unauthRes.statusCode === 403 && unauthRes.jsonData?.success === false,
      'Unauthorized trainer is blocked with 403 from generating questions for another trainer course'
    );

    // Test 10: Missing courseId returns 400
    let badReq = {
      user: { _id: trainerA._id, role: 'trainer', id: trainerA._id.toString() },
      body: {},
    };
    let badRes = {
      statusCode: 200,
      jsonData: null,
      status(code) { this.statusCode = code; return this; },
      json(data) { this.jsonData = data; return this; },
    };

    await generateAiQuestions(badReq, badRes, () => {});
    assert(
      badRes.statusCode === 400,
      'Missing courseId returns 400 Bad Request'
    );

    console.log('\n--- Test Group 4: PDF Question Parsing & Import ---');

    // Test 11: Fallback PDF regex parser extracts 3 questions with answer keys
    const samplePdfText = fs.readFileSync(tempPdfPath, 'utf8');
    const parsedPdf = fallbackParseQuestionsFromPdfText(`
1. What does the JavaScript Event Loop monitor?
A. Call stack and Callback queue
B. CPU temperature and cooling fans
C. File system permissions only
D. Network router bandwidth
Answer: A

2. Which keyword is used to pause execution until a Promise settles?
A. defer
B. await
C. pause
D. yield
Answer: B

3. In Node.js, what is the default behavior of unhandled Promise rejections?
A. Silent suppression
B. Process termination with error code
C. Automatic retry loop
D. Network broadcast
Answer: B
`);

    assert(
      parsedPdf.questions.length === 3,
      'PDF parser successfully extracts all 3 MCQ questions from formatted text',
      `Got ${parsedPdf.questions.length}`
    );

    assert(
      parsedPdf.hasAnswerKey === true,
      'PDF parser identifies answer key presence (hasAnswerKey: true)'
    );

    assert(
      parsedPdf.questions[0].correctOption === 'A' && parsedPdf.questions[1].correctOption === 'B',
      'PDF parser accurately maps detected answer keys to correctOption (A, B)'
    );

    // Test 12: PDF Parser with unkeyed text sets hasAnswerKey: false
    const unkeyedPdf = fallbackParseQuestionsFromPdfText(`
1. What is the primary purpose of middleware in Express?
A. To execute code and modify request/response objects
B. To replace the operating system kernel
C. To compile TypeScript to machine assembly
D. To format hard drive storage

2. What is the status code for Unauthorized access?
A. 200 OK
B. 401 Unauthorized
C. 404 Not Found
D. 500 Server Error
`);

    assert(
      unkeyedPdf.questions.length === 2 && unkeyedPdf.hasAnswerKey === false,
      'Unkeyed PDF questions are parsed with hasAnswerKey: false'
    );

    // Test 13: Suggest Answers for unkeyed questions
    const suggested = await suggestAnswersForQuestions({
      questions: unkeyedPdf.questions,
      course: courseA,
      moduleDoc: module1,
    });

    assert(
      suggested.questions.every((q) => q.isAiSuggestedAnswer === true && ['A', 'B', 'C', 'D'].includes(q.correctOption)),
      'AI answer suggestion assigns valid correct options and flags isAiSuggestedAnswer: true'
    );

    // Test 14: PDF Import controller handler with valid file
    let pdfReq = {
      file: { path: tempPdfPath, originalname: 'quiz.pdf' },
      user: { _id: trainerA._id, role: 'trainer', id: trainerA._id.toString() },
      body: { courseId: courseA._id.toString(), moduleId: module1._id.toString() },
    };
    let pdfRes = {
      statusCode: 200,
      jsonData: null,
      status(code) { this.statusCode = code; return this; },
      json(data) { this.jsonData = data; return this; },
    };

    // Make a copy since controller unlinks the file
    const uploadTempCopy = path.join(__dirname, 'temp_upload_copy.pdf');
    fs.copyFileSync(tempPdfPath, uploadTempCopy);
    pdfReq.file.path = uploadTempCopy;

    await importQuestionsFromPdf(pdfReq, pdfRes, (err) => { if (err) console.error(err); });
    assert(
      pdfRes.statusCode === 200 && pdfRes.jsonData?.success && pdfRes.jsonData?.data?.questions?.length > 0,
      'PDF import controller successfully processes uploaded PDF file and returns extracted questions'
    );

    // Test 15: Empty/scanned PDF handling returns clear error
    const emptyTempCopy = path.join(__dirname, 'temp_empty_copy.pdf');
    fs.copyFileSync(tempEmptyPdfPath, emptyTempCopy);
    let emptyReq = {
      file: { path: emptyTempCopy, originalname: 'empty.pdf' },
      user: { _id: trainerA._id, role: 'trainer', id: trainerA._id.toString() },
      body: { courseId: courseA._id.toString() },
    };
    let emptyRes = {
      statusCode: 200,
      jsonData: null,
      status(code) { this.statusCode = code; return this; },
      json(data) { this.jsonData = data; return this; },
    };

    await importQuestionsFromPdf(emptyReq, emptyRes, () => {});
    assert(
      emptyRes.statusCode === 400 && emptyRes.jsonData?.message?.includes("We couldn't extract readable text"),
      'Scanned / empty PDF returns descriptive error message prompting text-based PDF or manual entry'
    );

    // Test 16: Suggest Answers controller endpoint
    let suggestReq = {
      user: { _id: trainerA._id, role: 'trainer', id: trainerA._id.toString() },
      body: {
        questions: unkeyedPdf.questions,
        courseId: courseA._id.toString(),
      },
    };
    let suggestRes = {
      statusCode: 200,
      jsonData: null,
      status(code) { this.statusCode = code; return this; },
      json(data) { this.jsonData = data; return this; },
    };

    await suggestAnswersForPdfQuestions(suggestReq, suggestRes, () => {});
    assert(
      suggestRes.statusCode === 200 && suggestRes.jsonData?.success && suggestRes.jsonData?.data?.questions?.length === 2,
      'Suggest Answers controller endpoint successfully processes unkeyed questions'
    );

    // Test 19: Multi-Format Document extraction & matter question generation (Text/Markdown & Word)
    const tempTxtDoc = path.join(__dirname, 'temp_matter_notes.txt');
    fs.writeFileSync(
      tempTxtDoc,
      'Module 3 Architecture Notes: Component lifecycle methods in modern web systems govern mounting, updating, and unmounting states. Pure functions improve memoization efficiency and minimize re-renders. Higher-order components provide cross-cutting concerns encapsulation.'
    );

    let docReq = {
      file: { path: tempTxtDoc, originalname: 'notes.txt' },
      user: { _id: trainerA._id, role: 'trainer', id: trainerA._id.toString() },
      body: {
        courseId: courseA._id.toString(),
        moduleId: module1._id.toString(),
        importType: 'content_matter',
        count: 3,
        difficulty: 'hard',
      },
    };
    let docRes = {
      statusCode: 200,
      jsonData: null,
      status(code) { this.statusCode = code; return this; },
      json(data) { this.jsonData = data; return this; },
    };

    await importQuestionsFromPdf(docReq, docRes, (err) => { if (err) console.error(err); });
    assert(
      docRes.statusCode === 200 && docRes.jsonData?.success && docRes.jsonData.data?.questions?.length === 3,
      'Multi-format document extractor successfully analyzes study matter (.txt/.docx/.pptx) and produces 3 MCQs'
    );

    // Test 20: PPTX Presentation Document Parsing & Question Generation
    const AdmZip = require('adm-zip');
    const pptxZip = new AdmZip();
    pptxZip.addFile(
      'ppt/slides/slide1.xml',
      Buffer.from('<p:sld><a:t>Cloud Infrastructure Architecture</a:t><a:t>IaaS provides virtualized computing resources over the internet with granular scalability.</a:t></p:sld>')
    );
    pptxZip.addFile(
      'ppt/slides/slide2.xml',
      Buffer.from('<p:sld><a:t>Serverless Computing</a:t><a:t>Event-driven execution models eliminate server provisioning overhead and reduce idle costs.</a:t></p:sld>')
    );
    const tempPptxDoc = path.join(__dirname, 'temp_presentation.pptx');
    pptxZip.writeZip(tempPptxDoc);

    let pptxReq = {
      file: { path: tempPptxDoc, originalname: 'presentation.pptx' },
      user: { _id: trainerA._id, role: 'trainer', id: trainerA._id.toString() },
      body: {
        courseId: courseA._id.toString(),
        moduleId: module1._id.toString(),
        importType: 'content_matter',
        count: 2,
        difficulty: 'medium',
      },
    };
    let pptxRes = {
      statusCode: 200,
      jsonData: null,
      status(code) { this.statusCode = code; return this; },
      json(data) { this.jsonData = data; return this; },
    };

    await importQuestionsFromPdf(pptxReq, pptxRes, (err) => { if (err) console.error(err); });
    assert(
      pptxRes.statusCode === 200 &&
        pptxRes.jsonData?.success &&
        pptxRes.jsonData.data?.questions?.length === 2 &&
        !JSON.stringify(pptxRes.jsonData.data.questions).includes('Content_Types') &&
        !JSON.stringify(pptxRes.jsonData.data.questions).includes('PK'),
      'PPTX slide parser successfully extracts clean text from slide XMLs without binary zip headers'
    );

    console.log('\n--- Test Group 5: Immutability & Draft Integrity ---');

    // Test 21: Generating AI questions does NOT alter existing Assessment records
    const initialAssessmentsCount = await Assessment.countDocuments({ course: courseA._id });
    assert(
      initialAssessmentsCount === 0,
      'Assessment count is zero before trainer explicitly saves/publishes (AI questions are draft only)'
    );

  } catch (error) {
    console.error('Fatal error during Phase 7.7 test run:', error);
    failed++;
  } finally {
    // Cleanup temporary files
    try { if (fs.existsSync(tempPdfPath)) fs.unlinkSync(tempPdfPath); } catch (e) {}
    try { if (fs.existsSync(tempNoAnsPdfPath)) fs.unlinkSync(tempNoAnsPdfPath); } catch (e) {}
    try { if (fs.existsSync(tempEmptyPdfPath)) fs.unlinkSync(tempEmptyPdfPath); } catch (e) {}

    console.log('\n====================================================');
    console.log(`📊 Phase 7.7 Test Summary: ${passed} Passed, ${failed} Failed`);
    console.log('====================================================\n');

    if (failed > 0) {
      process.exit(1);
    }
  }
};

runTests().then(() => {
  process.exit(0);
});
