// MOVIL-APP/app/(tabs)/_layout.js
import { Tabs } from 'expo-router';
import React from 'react';
import { Image, View, Text } from 'react-native'; // Import View and Text for custom badge
import { Ionicons } from '@expo/vector-icons'; // Assuming Ionicons is used for icons
import { useAuth } from '../../contexts/AuthContext'; // Import useAuth to get user info

// Component to display the gym logo in the header
function HeaderLogoTitle() {
  const { gymLogo } = useAuth();

  if (!gymLogo) {
    return null;
  }

  return (
    <Image
      style={{ width: 120, height: 40, resizeMode: 'contain' }}
      source={{ uri: gymLogo }}
    />
  );
}

export default function TabsLayout() {
  const { user, gymColor } = useAuth(); // Get the user info from AuthContext to access unreadNotificationsCount

  return (
    <Tabs 
      screenOptions={{
        tabBarActiveTintColor: gymColor, 
        headerTitleAlign: 'center',
        headerTitle: (props) => <HeaderLogoTitle {...props} />, 
        headerStyle: {
          backgroundColor: gymColor, 
        },
      }}
    >
      <Tabs.Screen 
        name="calendar" 
        options={{ 
          title: 'Calendario',
          tabBarIcon: ({ color, size, focused }) => (
            <Ionicons 
              name={focused ? 'calendar' : 'calendar-outline'} 
              size={size} 
              color={color} 
            />
          ),
        }} 
      />
      <Tabs.Screen 
        name="my-classes" 
        options={{ 
          title: 'Mis Clases',
          tabBarIcon: ({ color, size, focused }) => (
            <Ionicons 
              name={focused ? 'list' : 'list-outline'} 
              size={size} 
              color={color} 
            />
          ),
        }} 
      />
      <Tabs.Screen 
        name="profile" 
        options={{ 
          title: 'Mi Perfil',
          tabBarIcon: ({ color, size, focused }) => (
            <Ionicons 
              name={focused ? 'person' : 'person-outline'} 
              size={size} 
              color={color} 
            />
          ),
        }} 
      />
      <Tabs.Screen 
        name="notifications" 
        options={{ 
          title: 'Notificaciones',
          tabBarIcon: ({ color, size, focused }) => (
            <View>
              <Ionicons // Your existing Ionicons icon
                name={focused ? 'notifications' : 'notifications-outline'} 
                size={size} 
                color={color} 
              />
              {/* Display badge if there are unread notifications */}
              {user?.unreadNotificationsCount > 0 && (
                <View style={{
                  position: 'absolute',
                  right: -6, // Adjust position relative to the icon
                  top: -3,   // Adjust position relative to the icon
                  backgroundColor: 'red', // Badge background color
                  borderRadius: 8, // Half of width/height for a circular badge
                  width: 16,
                  height: 16,
                  justifyContent: 'center',
                  alignItems: 'center',
                }}>
                  <Text style={{ 
                    color: 'white', 
                    fontSize: 10, 
                    fontWeight: 'bold' 
                  }}>
                    {user.unreadNotificationsCount}
                  </Text>
                </View>
              )}
            </View>
          ),
          // Optionally, add a custom tabBarLabel to ensure text aligns well with badge
          tabBarLabel: ({ color }) => (
            <Text style={{ color: color, fontSize: 10 }}>Notificaciones</Text>
          ),
        }} 
      />
    </Tabs>
  );
}