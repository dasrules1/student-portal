#!/usr/bin/env node

/**
 * Migration script to convert plaintext teacher instructions to HTML format.
 * 
 * This script:
 * 1. Reads all curriculum documents from Firestore
 * 2. Finds content items with teachersInstructions field
 * 3. Converts plaintext to basic HTML (newlines to <p> and <br>)
 * 4. Optionally updates Firestore with the converted HTML
 * 
 * Usage:
 *   node scripts/migrate-instructions.js --dry-run     # Preview changes without updating
 *   node scripts/migrate-instructions.js               # Apply changes to Firestore
 */

const admin = require('firebase-admin');
const path = require('path');

// Initialize Firebase Admin SDK
const serviceAccountPath = process.env.GOOGLE_APPLICATION_CREDENTIALS || 
  path.join(__dirname, '../service-account-key.json');

let app;
try {
  const serviceAccount = require(serviceAccountPath);
  app = admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
  console.log('✅ Firebase Admin SDK initialized successfully');
} catch (error) {
  console.error('❌ Error initializing Firebase Admin SDK:');
  console.error('   Make sure GOOGLE_APPLICATION_CREDENTIALS env var is set');
  console.error('   or service-account-key.json exists in the project root');
  console.error('   Error:', error.message);
  process.exit(1);
}

const db = admin.firestore();

// Check for dry-run mode
const isDryRun = process.argv.includes('--dry-run');

/**
 * Convert plaintext to basic HTML
 * Converts newlines to paragraphs and preserves line breaks
 */
function convertPlaintextToHtml(text) {
  if (!text || typeof text !== 'string') {
    return text;
  }

  // Check if already HTML (contains HTML tags)
  if (/<\/?[a-z][\s\S]*>/i.test(text)) {
    console.log('   ℹ️  Content appears to already be HTML, skipping conversion');
    return text;
  }

  // Split by double newlines (paragraphs)
  const paragraphs = text.split(/\n\n+/);
  
  // Convert each paragraph to HTML
  const htmlParagraphs = paragraphs
    .filter(p => p.trim())
    .map(p => {
      // Replace single newlines with <br>
      const withBreaks = p.trim().replace(/\n/g, '<br>');
      return `<p>${withBreaks}</p>`;
    });

  return htmlParagraphs.join('\n');
}

/**
 * Process a single curriculum document
 */
async function processCurriculum(docRef, docData, docId) {
  let updateCount = 0;
  let modifiedContent = JSON.parse(JSON.stringify(docData)); // Deep clone
  let hasChanges = false;

  console.log(`\n📚 Processing curriculum: ${docId}`);

  if (!modifiedContent.content || !modifiedContent.content.lessons) {
    console.log('   ⚠️  No lessons found in curriculum');
    return updateCount;
  }

  // Iterate through lessons
  for (let lessonIndex = 0; lessonIndex < modifiedContent.content.lessons.length; lessonIndex++) {
    const lesson = modifiedContent.content.lessons[lessonIndex];
    
    if (!lesson.contents || !Array.isArray(lesson.contents)) {
      continue;
    }

    // Iterate through content items
    for (let contentIndex = 0; contentIndex < lesson.contents.length; contentIndex++) {
      const content = lesson.contents[contentIndex];
      
      // Check if teachersInstructions exists and needs conversion
      if (content.teachersInstructions && typeof content.teachersInstructions === 'string') {
        console.log(`   📝 Found teachersInstructions in Lesson "${lesson.title || lesson.id}", Content "${content.title || content.id}"`);
        
        const originalLength = content.teachersInstructions.length;
        const convertedHtml = convertPlaintextToHtml(content.teachersInstructions);
        
        if (convertedHtml !== content.teachersInstructions) {
          console.log(`      ✏️  Converting plaintext (${originalLength} chars) to HTML`);
          console.log(`      Original: ${content.teachersInstructions.substring(0, 100)}...`);
          console.log(`      Converted: ${convertedHtml.substring(0, 100)}...`);
          
          modifiedContent.content.lessons[lessonIndex].contents[contentIndex].teachersInstructions = convertedHtml;
          hasChanges = true;
          updateCount++;
        }
      }
    }
  }

  // Update Firestore if changes were made and not in dry-run mode
  if (hasChanges && !isDryRun) {
    console.log(`   💾 Updating ${updateCount} content item(s) in Firestore...`);
    await docRef.update({
      content: modifiedContent.content,
      lastUpdated: admin.firestore.FieldValue.serverTimestamp()
    });
    console.log('   ✅ Update successful');
  } else if (hasChanges && isDryRun) {
    console.log(`   🔍 [DRY RUN] Would update ${updateCount} content item(s)`);
  }

  return updateCount;
}

/**
 * Main migration function
 */
async function migrate() {
  console.log('🚀 Starting teacher instructions migration...');
  console.log(`Mode: ${isDryRun ? '🔍 DRY RUN (no changes will be made)' : '💾 LIVE (changes will be applied)'}`);
  console.log('');

  try {
    // Get all curriculum documents
    const curriculaSnapshot = await db.collection('curricula').get();
    
    if (curriculaSnapshot.empty) {
      console.log('⚠️  No curriculum documents found in Firestore');
      console.log('   Make sure you have curriculum data in the "curricula" collection');
      return;
    }

    console.log(`📊 Found ${curriculaSnapshot.size} curriculum document(s)\n`);

    let totalUpdates = 0;

    // Process each curriculum document
    for (const doc of curriculaSnapshot.docs) {
      const updates = await processCurriculum(doc.ref, doc.data(), doc.id);
      totalUpdates += updates;
    }

    console.log('\n' + '='.repeat(60));
    console.log('📈 Migration Summary');
    console.log('='.repeat(60));
    console.log(`Total curricula processed: ${curriculaSnapshot.size}`);
    console.log(`Total content items ${isDryRun ? 'that would be' : ''} updated: ${totalUpdates}`);
    
    if (isDryRun) {
      console.log('\n💡 Run without --dry-run flag to apply changes');
    } else {
      console.log('\n✅ Migration completed successfully!');
    }

  } catch (error) {
    console.error('\n❌ Error during migration:');
    console.error(error);
    process.exit(1);
  } finally {
    // Close the Firebase app
    await app.delete();
  }
}

// Run migration
migrate();
