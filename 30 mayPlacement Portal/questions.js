/* =====================================================
    CLOUD-SYNCED UNIVERSAL QUESTIONS DATABASE
    Version: 2.0
    Description: Fetches questions from Firebase Firestore
    Dependencies: Firebase SDK must be initialized before calling
===================================================== */

/**
 * Fetches questions from Firebase Firestore for the currently selected test.
 * This function is used by quiz.html, fullmock-quiz.html, and any other 
 * assessment page that needs to load questions from the cloud.
 * 
 * The 'db' object must be initialized in the HTML file before calling this function.
 * 
 * @returns {Promise<Array>} Promise that resolves to an array of question objects
 * @throws {Error} Throws an error if the Firebase query fails
 * 
 * Each question object contains:
 * - id: string (Firestore document ID)
 * - testId: string (ID of the parent test)
 * - text: string (Question text)
 * - options: array of strings (4 options: A, B, C, D)
 * - correct: number (0-3 index of correct answer)
 * - subject: string (Section name like "Numerical Ability", "Logical Reasoning", etc.)
 * - level: string ("Easy", "Medium", or "Hard")
 */
async function getQuestions() {
  // 1. Get the specific Test ID the user clicked from LocalStorage
  const activeTestId = localStorage.getItem("currentTestId");
  
  if (!activeTestId) {
    console.error("[getQuestions] No currentTestId found in LocalStorage.");
    return [];
  }

  try {
    // 2. Fetch from Firebase "questions" collection where testId matches
    const snapshot = await db.collection("questions")
      .where("testId", "==", activeTestId)
      .get();

    if (snapshot.empty) {
      console.warn("[getQuestions] No questions found in cloud for Test ID:", activeTestId);
      return [];
    }

    // 3. Convert the cloud documents into a standard array[cite: 3]
    const cloudQuestions = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));

    console.log(`[getQuestions] Cloud Sync: Loaded ${cloudQuestions.length} questions for Test ID: ${activeTestId}`);
    return cloudQuestions;

  } catch (error) {
    console.error("[getQuestions] Error fetching questions from Cloud:", error);
    throw error; // Pass the error back to the UI to show the "Connection Error" message
  }
}

/**
 * Alternative function to get questions with a specific test ID
 * Useful for admin preview or when you already know the test ID
 * 
 * @param {string} testId - The Firestore document ID of the test
 * @returns {Promise<Array>} Promise that resolves to an array of question objects
 */
async function getQuestionsByTestId(testId) {
  if (!testId) {
    console.error("[getQuestionsByTestId] No testId provided.");
    return [];
  }

  try {
    const snapshot = await db.collection("questions")
      .where("testId", "==", testId)
      .get();

    if (snapshot.empty) {
      console.warn("[getQuestionsByTestId] No questions found for Test ID:", testId);
      return [];
    }

    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
  } catch (error) {
    console.error("[getQuestionsByTestId] Error:", error);
    throw error;
  }
}

/**
 * Gets a single question by its Firestore document ID
 * 
 * @param {string} questionId - The Firestore document ID of the question
 * @returns {Promise<Object|null>} Promise that resolves to the question object or null
 */
async function getQuestionById(questionId) {
  if (!questionId) {
    console.error("[getQuestionById] No questionId provided.");
    return null;
  }

  try {
    const doc = await db.collection("questions").doc(questionId).get();
    if (!doc.exists) {
      console.warn("[getQuestionById] Question not found:", questionId);
      return null;
    }
    return { id: doc.id, ...doc.data() };
  } catch (error) {
    console.error("[getQuestionById] Error:", error);
    throw error;
  }
}

/**
 * Gets all questions for a specific test with filtering options
 * 
 * @param {string} testId - The Firestore document ID of the test
 * @param {Object} filters - Optional filters
 * @param {string} filters.level - Filter by difficulty: "Easy", "Medium", or "Hard"
 * @param {string} filters.subject - Filter by subject/section
 * @returns {Promise<Array>} Promise that resolves to filtered array of question objects
 */
async function getFilteredQuestions(testId, filters = {}) {
  if (!testId) {
    console.error("[getFilteredQuestions] No testId provided.");
    return [];
  }

  try {
    let query = db.collection("questions").where("testId", "==", testId);
    
    if (filters.level) {
      query = query.where("level", "==", filters.level);
    }
    if (filters.subject) {
      query = query.where("subject", "==", filters.subject);
    }
    
    const snapshot = await query.get();
    
    if (snapshot.empty) {
      return [];
    }
    
    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
  } catch (error) {
    console.error("[getFilteredQuestions] Error:", error);
    throw error;
  }
}

/**
 * Gets the count of questions for a specific test
 * Useful for displaying test statistics without loading all questions
 * 
 * @param {string} testId - The Firestore document ID of the test
 * @returns {Promise<number>} Promise that resolves to the question count
 */
async function getQuestionCount(testId) {
  if (!testId) {
    return 0;
  }

  try {
    const snapshot = await db.collection("questions")
      .where("testId", "==", testId)
      .get();
    return snapshot.size;
  } catch (error) {
    console.error("[getQuestionCount] Error:", error);
    return 0;
  }
}

// Export functions for use in other modules (if using modules)
// For standard script tags, these functions are globally available
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    getQuestions,
    getQuestionsByTestId,
    getQuestionById,
    getFilteredQuestions,
    getQuestionCount
  };
}