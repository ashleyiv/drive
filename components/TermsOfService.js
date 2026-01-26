import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import useTheme from '../theme/useTheme';
import TermsContent from './TermsContent';


export default function TermsOfService({ onBack }) {
  const { theme, isDark, toggleTheme } = useTheme();

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack}>
          <Ionicons name="arrow-back" size={24} color="white" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Terms of Service</Text>
      </View>

            <ScrollView contentContainerStyle={styles.content}>
        <TermsContent />
      </ScrollView>

    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: 'white' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#1E40AF',
  },
  headerTitle: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
    marginLeft: 12,
  },
  content: { padding: 20 },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginTop: 16,
  },
  text: {
    fontSize: 15,
    color: '#374151',
    marginTop: 8,
    lineHeight: 22,
  },
  bullet: {
    fontSize: 15,
    color: '#374151',
    marginTop: 8,
    lineHeight: 22,
  },
  warning: {
    fontSize: 15,
    color: '#FF000D',
    marginTop: 8,
    fontWeight: 'bold',
    lineHeight: 22,
  },
});
