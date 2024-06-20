function score_data (data) {
    function countSyllables(word) {
        // Regular expression to match syllables in a word
        let syllableRegex = /[^aeiouy]*[aeiouy]+(?:[^aeiouy](?=[^aeiouy]))?/gi;
        // Match the syllables in the word and return the length of the resulting array
        return (word.match(syllableRegex) || []).length;
    }
    
    function averageSyllablesPerWord(text) {
        // Remove punctuation and split the text into an array of words
        let words = text.replace(/[^\w\s]/g, '').split(/\s+/);
        // Initialize variables to store the total number of syllables and words
        let totalSyllables = 0;
        let totalWords = words.length;
        // Iterate through each word and count its syllables
        words.forEach(word => {
            totalSyllables += countSyllables(word);
        });
        // Calculate the average syllables per word
        return totalSyllables / totalWords;
    }
    
    // Example usage:
    
    
    let avgSyllablesPerWord = averageSyllablesPerWord(data);
    //console.log("Average syllables per word:", avgSyllablesPerWord);
    
    function averageSentenceLength(text) {
        // Split the text into an array of sentences using punctuation marks as delimiters
        let sentences = text.split(/[.!?]+/);
        // Remove empty strings from the array (resulting from consecutive punctuation marks)
        sentences = sentences.filter(sentence => sentence.trim() !== "");
        
        // Initialize variables to store the total number of words and sentences
        let totalWords = 0;
        let totalSentences = sentences.length;
    
        // Iterate through each sentence and count its words
        sentences.forEach(sentence => {
            // Split the sentence into an array of words using whitespace as the delimiter
            let words = sentence.trim().split(/\s+/);
            // Add the number of words in the sentence to the total word count
            totalWords += words.length;
        });
    
        // Calculate the average sentence length
        return totalWords / totalSentences;
    }
    
    // Example usage:
    
    let avgSentenceLength = averageSentenceLength(data);
    //console.log("Average sentence length:", avgSentenceLength);
    
    let a = avgSyllablesPerWord;
    let b = avgSentenceLength
    score_1 = 206.835-(1.015*b)-(84.6*a)
    score = score_1.toFixed(2)
    return score;
}

module.exports = {score_data};